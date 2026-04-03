import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApartmentService, ScrapeFilters } from '../../services/apartment.service';
import { JobService } from '../../services/job.service';
import { isDevMode } from '@angular/core';

interface PropertyTypes {
  appartement: boolean;
  maison: boolean;
  terrain: boolean;
  parking: boolean;
  autre: boolean;
}

interface RecentApartmentSearch {
  city: string;
  minPrice: number | null;
  maxPrice: number | null;
  propertyTypes: PropertyTypes;
  minRooms: number | null;
  maxRooms: number | null;
  minBedrooms: number | null;
  maxBedrooms: number | null;
  minSurface: number | null;
  maxSurface: number | null;
  minLandSurface: number | null;
  maxLandSurface: number | null;
  furnished: string;
  date: string;
}

interface RecentJobSearch {
  keyword: string;
  city: string;
  date: string;
}

const RECENT_APT_SEARCHES_KEY = 'recentApartmentSearches';
const RECENT_JOB_SEARCHES_KEY = 'recentJobSearches';
const MAX_RECENT_SEARCHES = 5;

@Component({
  selector: 'app-scraper',
  imports: [FormsModule],
  templateUrl: './scraper.html',
  styleUrl: './scraper.scss',
})
export class Scraper implements OnInit {
  private readonly apiUrl = isDevMode() ? 'http://localhost:3000/api' : '/api';

  readonly scrapingApartments = signal(false);
  readonly scrapingJobs = signal(false);

  // Apartment scrape fields
  scrapeCity = '';
  scrapeMinPrice: number | null = null;
  scrapeMaxPrice: number | null = null;
  scrapePropertyTypes: PropertyTypes = {
    appartement: true, maison: false, terrain: false, parking: false, autre: false,
  };
  scrapeMinRooms: number | null = null;
  scrapeMaxRooms: number | null = null;
  scrapeMinBedrooms: number | null = null;
  scrapeMaxBedrooms: number | null = null;
  scrapeMinSurface: number | null = null;
  scrapeMaxSurface: number | null = null;
  scrapeMinLandSurface: number | null = null;
  scrapeMaxLandSurface: number | null = null;
  scrapeFurnished = '';
  roomOptions = [1, 2, 3, 4, 5, 6, 7, 8];

  // Job scrape fields
  scrapeKeyword = '';
  scrapeJobCity = '';

  // Recent searches
  recentAptSearches: RecentApartmentSearch[] = [];
  recentJobSearches: RecentJobSearch[] = [];

  // Auto filters (scheduler)
  autoAptFilters: Record<string, unknown> | null = null;
  autoJobFilters: { keyword: string; city: string } | null = null;
  schedulerCron = '';

  constructor(
    private apartmentService: ApartmentService,
    private jobService: JobService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.loadRecentSearches();
    this.loadAutoFilters();
    this.loadSchedulerStatus();
  }

  // ─── Auto Filters ───
  loadAutoFilters(): void {
    this.http.get<{ apartments: Record<string, unknown> | null; jobs: { keyword: string; city: string } | null }>(
      `${this.apiUrl}/scrape/auto-filters`
    ).subscribe({
      next: (data) => {
        this.autoAptFilters = data.apartments;
        this.autoJobFilters = data.jobs;
      },
    });
  }

  loadSchedulerStatus(): void {
    this.http.get<{ running: boolean; cron: string }>(
      `${this.apiUrl}/scheduler/status`
    ).subscribe({
      next: (data) => {
        this.schedulerCron = data.cron;
      },
    });
  }

  getCronLabel(cron: string): string {
    const match = cron.match(/\*\/(\d+)/);
    if (match) return `Toutes les ${match[1]}h`;
    return cron;
  }

  // ─── Apartment Scrape ───
  scrapeApartments(): void {
    if (!this.scrapeCity) return;
    this.scrapingApartments.set(true);

    const selectedTypes = Object.entries(this.scrapePropertyTypes)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    const scrapeFilters: ScrapeFilters = { city: this.scrapeCity };
    if (this.scrapeMinPrice) scrapeFilters.minPrice = this.scrapeMinPrice;
    if (this.scrapeMaxPrice) scrapeFilters.maxPrice = this.scrapeMaxPrice;
    if (selectedTypes.length > 0) scrapeFilters.propertyTypes = selectedTypes;
    if (this.scrapeMinRooms) scrapeFilters.minRooms = this.scrapeMinRooms;
    if (this.scrapeMaxRooms) scrapeFilters.maxRooms = this.scrapeMaxRooms;
    if (this.scrapeMinBedrooms) scrapeFilters.minBedrooms = this.scrapeMinBedrooms;
    if (this.scrapeMaxBedrooms) scrapeFilters.maxBedrooms = this.scrapeMaxBedrooms;
    if (this.scrapeMinSurface) scrapeFilters.minSurface = this.scrapeMinSurface;
    if (this.scrapeMaxSurface) scrapeFilters.maxSurface = this.scrapeMaxSurface;
    if (this.scrapeMinLandSurface) scrapeFilters.minLandSurface = this.scrapeMinLandSurface;
    if (this.scrapeMaxLandSurface) scrapeFilters.maxLandSurface = this.scrapeMaxLandSurface;
    if (this.scrapeFurnished) scrapeFilters.furnished = this.scrapeFurnished;

    this.apartmentService.scrape(scrapeFilters).subscribe({
      next: (res) => {
        this.scrapingApartments.set(false);
        this.saveRecentAptSearch();
        this.loadAutoFilters();
        alert(`${res.count} nouvelles annonces importees !`);
      },
      error: (err) => {
        this.scrapingApartments.set(false);
        alert('Erreur: ' + (err.error?.details || err.message));
      },
    });
  }

  // ─── Job Scrape ───
  scrapeJobs(): void {
    if (!this.scrapeKeyword || !this.scrapeJobCity) return;
    this.scrapingJobs.set(true);
    this.jobService.scrape(this.scrapeKeyword, this.scrapeJobCity).subscribe({
      next: (res) => {
        this.scrapingJobs.set(false);
        this.saveRecentJobSearch();
        this.loadAutoFilters();
        alert(`${res.count} nouvelles offres importees !`);
      },
      error: (err) => {
        this.scrapingJobs.set(false);
        alert('Erreur: ' + (err.error?.details || err.message));
      },
    });
  }

  // ─── Room Chips ───
  toggleRoom(field: 'scrapeMinRooms' | 'scrapeMaxRooms' | 'scrapeMinBedrooms' | 'scrapeMaxBedrooms', value: number): void {
    if (this[field] === value) {
      this[field] = null;
    } else {
      this[field] = value;
    }
  }

  isRoomInRange(min: number | null, max: number | null, value: number): boolean {
    if (min !== null && max !== null) return value >= min && value <= max;
    if (min !== null) return value === min;
    if (max !== null) return value === max;
    return false;
  }

  getSelectedTypes(types: PropertyTypes): string {
    return Object.entries(types)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(', ') || 'tous';
  }

  // ─── Recent Searches ───
  loadRecentSearches(): void {
    try {
      const aptStored = localStorage.getItem(RECENT_APT_SEARCHES_KEY);
      this.recentAptSearches = aptStored ? JSON.parse(aptStored) : [];
    } catch { this.recentAptSearches = []; }
    try {
      const jobStored = localStorage.getItem(RECENT_JOB_SEARCHES_KEY);
      this.recentJobSearches = jobStored ? JSON.parse(jobStored) : [];
    } catch { this.recentJobSearches = []; }
  }

  saveRecentAptSearch(): void {
    const search: RecentApartmentSearch = {
      city: this.scrapeCity,
      minPrice: this.scrapeMinPrice, maxPrice: this.scrapeMaxPrice,
      propertyTypes: { ...this.scrapePropertyTypes },
      minRooms: this.scrapeMinRooms, maxRooms: this.scrapeMaxRooms,
      minBedrooms: this.scrapeMinBedrooms, maxBedrooms: this.scrapeMaxBedrooms,
      minSurface: this.scrapeMinSurface, maxSurface: this.scrapeMaxSurface,
      minLandSurface: this.scrapeMinLandSurface, maxLandSurface: this.scrapeMaxLandSurface,
      furnished: this.scrapeFurnished, date: new Date().toISOString(),
    };
    this.recentAptSearches = this.recentAptSearches.filter(
      (s) => s.city.toLowerCase() !== this.scrapeCity.toLowerCase()
    );
    this.recentAptSearches.unshift(search);
    this.recentAptSearches = this.recentAptSearches.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_APT_SEARCHES_KEY, JSON.stringify(this.recentAptSearches));
  }

  saveRecentJobSearch(): void {
    const search: RecentJobSearch = {
      keyword: this.scrapeKeyword, city: this.scrapeJobCity, date: new Date().toISOString(),
    };
    this.recentJobSearches = this.recentJobSearches.filter(
      (s) => !(s.keyword.toLowerCase() === this.scrapeKeyword.toLowerCase() && s.city.toLowerCase() === this.scrapeJobCity.toLowerCase())
    );
    this.recentJobSearches.unshift(search);
    this.recentJobSearches = this.recentJobSearches.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_JOB_SEARCHES_KEY, JSON.stringify(this.recentJobSearches));
  }

  applyRecentAptSearch(search: RecentApartmentSearch): void {
    this.scrapeCity = search.city;
    this.scrapeMinPrice = search.minPrice; this.scrapeMaxPrice = search.maxPrice;
    this.scrapePropertyTypes = { ...search.propertyTypes };
    this.scrapeMinRooms = search.minRooms; this.scrapeMaxRooms = search.maxRooms;
    this.scrapeMinBedrooms = search.minBedrooms; this.scrapeMaxBedrooms = search.maxBedrooms;
    this.scrapeMinSurface = search.minSurface; this.scrapeMaxSurface = search.maxSurface;
    this.scrapeMinLandSurface = search.minLandSurface; this.scrapeMaxLandSurface = search.maxLandSurface;
    this.scrapeFurnished = search.furnished;
  }

  applyRecentJobSearch(search: RecentJobSearch): void {
    this.scrapeKeyword = search.keyword;
    this.scrapeJobCity = search.city;
  }

  removeRecentAptSearch(index: number, event: Event): void {
    event.stopPropagation();
    this.recentAptSearches.splice(index, 1);
    localStorage.setItem(RECENT_APT_SEARCHES_KEY, JSON.stringify(this.recentAptSearches));
  }

  removeRecentJobSearch(index: number, event: Event): void {
    event.stopPropagation();
    this.recentJobSearches.splice(index, 1);
    localStorage.setItem(RECENT_JOB_SEARCHES_KEY, JSON.stringify(this.recentJobSearches));
  }
}
