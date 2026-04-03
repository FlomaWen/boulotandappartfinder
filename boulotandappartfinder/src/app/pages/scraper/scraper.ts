import { Component, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApartmentService, ScrapeFilters } from '../../services/apartment.service';
import { JobService } from '../../services/job.service';
import { isDevMode } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, filter } from 'rxjs/operators';

interface PropertyTypes {
  appartement: boolean;
  maison: boolean;
  terrain: boolean;
  parking: boolean;
  autre: boolean;
}

interface AutoSearch {
  id: number;
  type: 'apartments' | 'jobs';
  name: string;
  filters: Record<string, unknown>;
  active: number;
  created_at: string;
}

interface CitySuggestion {
  nom: string;
  codesPostaux: string[];
  code: string;
  label: string; // computed: "Bordeaux (33000)"
}

interface RecentApartmentSearch {
  city: string;
  cities: string[];
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
  cities: string[];
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
  private readonly geoApiUrl = 'https://geo.api.gouv.fr/communes';

  readonly scrapingApartments = signal(false);
  readonly scrapingJobs = signal(false);

  // Apartment scrape fields
  scrapeCities: string[] = [];
  scrapeCityInput = '';
  scrapeCitySuggestions: CitySuggestion[] = [];
  showScrapeCitySuggestions = false;
  private scrapeCitySearch$ = new Subject<string>();

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
  scrapeJobCities: string[] = [];
  scrapeJobCityInput = '';
  scrapeJobCitySuggestions: CitySuggestion[] = [];
  showScrapeJobCitySuggestions = false;
  private scrapeJobCitySearch$ = new Subject<string>();

  // Recent searches
  recentAptSearches: RecentApartmentSearch[] = [];
  recentJobSearches: RecentJobSearch[] = [];

  // Auto searches
  autoSearches: AutoSearch[] = [];
  schedulerCron = '';

  // Modal state
  showModal = false;
  modalType: 'apartments' | 'jobs' = 'apartments';
  modalName = '';
  modalCities: string[] = [];
  modalCityInput = '';
  modalCitySuggestions: CitySuggestion[] = [];
  showModalCitySuggestions = false;
  private modalCitySearch$ = new Subject<string>();

  modalMinPrice: number | null = null;
  modalMaxPrice: number | null = null;
  modalPropertyTypes: PropertyTypes = {
    appartement: true, maison: false, terrain: false, parking: false, autre: false,
  };
  modalMinRooms: number | null = null;
  modalMaxRooms: number | null = null;
  modalMinBedrooms: number | null = null;
  modalMaxBedrooms: number | null = null;
  modalMinSurface: number | null = null;
  modalMaxSurface: number | null = null;
  modalFurnished = '';
  modalJobKeyword = '';
  modalJobCities: string[] = [];
  modalJobCityInput = '';
  modalJobCitySuggestions: CitySuggestion[] = [];
  showModalJobCitySuggestions = false;
  private modalJobCitySearch$ = new Subject<string>();

  constructor(
    private apartmentService: ApartmentService,
    private jobService: JobService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadRecentSearches();
    this.loadAutoSearches();
    this.loadSchedulerStatus();
    this.setupCityAutocomplete();
  }

  // ─── City Autocomplete ───
  private setupCityAutocomplete(): void {
    const setupSearch = (subject: Subject<string>, callback: (results: CitySuggestion[]) => void) => {
      subject.pipe(
        debounceTime(250),
        filter((q) => q.length >= 2),
        switchMap((q) =>
          this.http.get<Array<{ nom: string; codesPostaux: string[]; code: string }>>(
            `${this.geoApiUrl}?nom=${encodeURIComponent(q)}&fields=codesPostaux&limit=8`
          )
        ),
      ).subscribe({
        next: (communes) => {
          const suggestions: CitySuggestion[] = [];
          for (const c of communes) {
            for (const cp of c.codesPostaux) {
              suggestions.push({
                nom: c.nom,
                codesPostaux: c.codesPostaux,
                code: c.code,
                label: `${c.nom} (${cp})`,
              });
            }
          }
          callback(suggestions.slice(0, 10));
        },
      });
    };

    setupSearch(this.scrapeCitySearch$, (r) => { this.scrapeCitySuggestions = r; this.showScrapeCitySuggestions = r.length > 0; });
    setupSearch(this.scrapeJobCitySearch$, (r) => { this.scrapeJobCitySuggestions = r; this.showScrapeJobCitySuggestions = r.length > 0; });
    setupSearch(this.modalCitySearch$, (r) => { this.modalCitySuggestions = r; this.showModalCitySuggestions = r.length > 0; });
    setupSearch(this.modalJobCitySearch$, (r) => { this.modalJobCitySuggestions = r; this.showModalJobCitySuggestions = r.length > 0; });
  }

  onScrapeCityInput(): void {
    this.scrapeCitySearch$.next(this.scrapeCityInput);
    if (this.scrapeCityInput.length < 2) this.showScrapeCitySuggestions = false;
  }

  selectScrapeCity(suggestion: CitySuggestion): void {
    if (!this.scrapeCities.includes(suggestion.label)) {
      this.scrapeCities.push(suggestion.label);
    }
    this.scrapeCityInput = '';
    this.showScrapeCitySuggestions = false;
  }

  removeScrapeCity(city: string): void {
    this.scrapeCities = this.scrapeCities.filter((c) => c !== city);
  }

  onScrapeJobCityInput(): void {
    this.scrapeJobCitySearch$.next(this.scrapeJobCityInput);
    if (this.scrapeJobCityInput.length < 2) this.showScrapeJobCitySuggestions = false;
  }

  selectScrapeJobCity(suggestion: CitySuggestion): void {
    if (!this.scrapeJobCities.includes(suggestion.label)) {
      this.scrapeJobCities.push(suggestion.label);
    }
    this.scrapeJobCityInput = '';
    this.showScrapeJobCitySuggestions = false;
  }

  removeScrapeJobCity(city: string): void {
    this.scrapeJobCities = this.scrapeJobCities.filter((c) => c !== city);
  }

  onModalCityInput(): void {
    this.modalCitySearch$.next(this.modalCityInput);
    if (this.modalCityInput.length < 2) this.showModalCitySuggestions = false;
  }

  selectModalCity(suggestion: CitySuggestion): void {
    if (!this.modalCities.includes(suggestion.label)) {
      this.modalCities.push(suggestion.label);
    }
    this.modalCityInput = '';
    this.showModalCitySuggestions = false;
  }

  removeModalCity(city: string): void {
    this.modalCities = this.modalCities.filter((c) => c !== city);
  }

  onModalJobCityInput(): void {
    this.modalJobCitySearch$.next(this.modalJobCityInput);
    if (this.modalJobCityInput.length < 2) this.showModalJobCitySuggestions = false;
  }

  selectModalJobCity(suggestion: CitySuggestion): void {
    if (!this.modalJobCities.includes(suggestion.label)) {
      this.modalJobCities.push(suggestion.label);
    }
    this.modalJobCityInput = '';
    this.showModalJobCitySuggestions = false;
  }

  removeModalJobCity(city: string): void {
    this.modalJobCities = this.modalJobCities.filter((c) => c !== city);
  }

  hideSuggestions(field: 'scrapeCity' | 'scrapeJobCity' | 'modalCity' | 'modalJobCity'): void {
    // Delay to allow click on suggestion before hiding
    setTimeout(() => {
      if (field === 'scrapeCity') this.showScrapeCitySuggestions = false;
      else if (field === 'scrapeJobCity') this.showScrapeJobCitySuggestions = false;
      else if (field === 'modalCity') this.showModalCitySuggestions = false;
      else if (field === 'modalJobCity') this.showModalJobCitySuggestions = false;
    }, 200);
  }

  // ─── Auto Searches ───
  loadAutoSearches(): void {
    this.http.get<AutoSearch[]>(`${this.apiUrl}/auto-searches`).subscribe({
      next: (data) => {
        console.log('[Scraper] Loaded auto searches:', data);
        this.autoSearches = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[Scraper] Failed to load auto searches:', err);
      },
    });
  }

  loadSchedulerStatus(): void {
    this.http.get<{ running: boolean; cron: string }>(
      `${this.apiUrl}/scheduler/status`
    ).subscribe({
      next: (data) => { this.schedulerCron = data.cron; },
    });
  }

  getCronLabel(cron: string): string {
    const match = cron.match(/\*\/(\d+)/);
    if (match) return `Toutes les ${match[1]}h`;
    return cron;
  }

  toggleAutoSearch(search: AutoSearch): void {
    this.http.patch<{ id: number; active: number }>(
      `${this.apiUrl}/auto-searches/${search.id}/toggle`, {}
    ).subscribe({
      next: (res) => { search.active = res.active; },
    });
  }

  deleteAutoSearch(search: AutoSearch): void {
    if (!confirm(`Supprimer la recherche "${search.name}" ?`)) return;
    this.http.delete(`${this.apiUrl}/auto-searches/${search.id}`).subscribe({
      next: () => { this.autoSearches = this.autoSearches.filter((s) => s.id !== search.id); },
    });
  }

  getAutoSearchLabel(search: AutoSearch): string {
    const f = search.filters;
    if (search.type === 'apartments') {
      const parts: string[] = [];
      const cities = (f['cities'] as string[]) || (f['city'] ? [f['city'] as string] : []);
      if (cities.length > 0) parts.push(cities.join(', '));
      if (f['maxPrice']) parts.push(`max ${f['maxPrice']}€`);
      if (f['minSurface']) parts.push(`${f['minSurface']}m²+`);
      if (f['minRooms']) parts.push(`${f['minRooms']}p+`);
      return parts.join(' · ') || 'Aucun filtre';
    } else {
      const cities = (f['cities'] as string[]) || (f['city'] ? [f['city'] as string] : []);
      return `${f['keyword'] || '?'} · ${cities.join(', ') || '?'}`;
    }
  }

  // ─── Modal ───
  openModal(type: 'apartments' | 'jobs'): void {
    this.modalType = type;
    this.modalName = '';
    this.showModal = true;
    if (type === 'apartments') {
      this.modalCities = [];
      this.modalCityInput = '';
      this.modalMinPrice = null;
      this.modalMaxPrice = null;
      this.modalPropertyTypes = { appartement: true, maison: false, terrain: false, parking: false, autre: false };
      this.modalMinRooms = null;
      this.modalMaxRooms = null;
      this.modalMinBedrooms = null;
      this.modalMaxBedrooms = null;
      this.modalMinSurface = null;
      this.modalMaxSurface = null;
      this.modalFurnished = '';
    } else {
      this.modalJobKeyword = '';
      this.modalJobCities = [];
      this.modalJobCityInput = '';
    }
  }

  closeModal(): void {
    this.showModal = false;
  }

  saveAutoSearch(): void {
    let name = this.modalName;
    let filters: Record<string, unknown>;

    if (this.modalType === 'apartments') {
      if (this.modalCities.length === 0) return;
      if (!name) name = this.modalCities.join(', ');

      const selectedTypes = Object.entries(this.modalPropertyTypes)
        .filter(([_, v]) => v)
        .map(([k]) => k);

      filters = { cities: this.modalCities };
      if (this.modalMinPrice) filters['minPrice'] = this.modalMinPrice;
      if (this.modalMaxPrice) filters['maxPrice'] = this.modalMaxPrice;
      if (selectedTypes.length > 0) filters['propertyTypes'] = selectedTypes;
      if (this.modalMinRooms) filters['minRooms'] = this.modalMinRooms;
      if (this.modalMaxRooms) filters['maxRooms'] = this.modalMaxRooms;
      if (this.modalMinBedrooms) filters['minBedrooms'] = this.modalMinBedrooms;
      if (this.modalMaxBedrooms) filters['maxBedrooms'] = this.modalMaxBedrooms;
      if (this.modalMinSurface) filters['minSurface'] = this.modalMinSurface;
      if (this.modalMaxSurface) filters['maxSurface'] = this.modalMaxSurface;
      if (this.modalFurnished) filters['furnished'] = this.modalFurnished;
    } else {
      if (!this.modalJobKeyword || this.modalJobCities.length === 0) return;
      if (!name) name = `${this.modalJobKeyword} - ${this.modalJobCities.join(', ')}`;
      filters = { keyword: this.modalJobKeyword, cities: this.modalJobCities };
    }

    this.http.post<AutoSearch>(`${this.apiUrl}/auto-searches`, {
      type: this.modalType, name, filters,
    }).subscribe({
      next: (created) => {
        created.filters = filters;
        this.autoSearches.unshift(created);
        this.closeModal();
      },
    });
  }

  toggleModalRoom(field: 'modalMinRooms' | 'modalMaxRooms' | 'modalMinBedrooms' | 'modalMaxBedrooms', value: number): void {
    if (this[field] === value) {
      this[field] = null;
    } else {
      this[field] = value;
    }
  }

  // ─── Apartment Scrape ───
  scrapeApartments(): void {
    if (this.scrapeCities.length === 0) return;
    this.scrapingApartments.set(true);

    const selectedTypes = Object.entries(this.scrapePropertyTypes)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    const scrapeFilters: ScrapeFilters = { cities: this.scrapeCities };
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
    if (!this.scrapeKeyword || this.scrapeJobCities.length === 0) return;
    this.scrapingJobs.set(true);

    this.http.post<{ message: string; count: number }>(`${this.apiUrl}/scrape/jobs`, {
      keyword: this.scrapeKeyword,
      cities: this.scrapeJobCities,
    }).subscribe({
      next: (res) => {
        this.scrapingJobs.set(false);
        this.saveRecentJobSearch();
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
      city: this.scrapeCities.join(', '),
      cities: [...this.scrapeCities],
      minPrice: this.scrapeMinPrice, maxPrice: this.scrapeMaxPrice,
      propertyTypes: { ...this.scrapePropertyTypes },
      minRooms: this.scrapeMinRooms, maxRooms: this.scrapeMaxRooms,
      minBedrooms: this.scrapeMinBedrooms, maxBedrooms: this.scrapeMaxBedrooms,
      minSurface: this.scrapeMinSurface, maxSurface: this.scrapeMaxSurface,
      minLandSurface: this.scrapeMinLandSurface, maxLandSurface: this.scrapeMaxLandSurface,
      furnished: this.scrapeFurnished, date: new Date().toISOString(),
    };
    this.recentAptSearches = this.recentAptSearches.filter(
      (s) => s.city.toLowerCase() !== search.city.toLowerCase()
    );
    this.recentAptSearches.unshift(search);
    this.recentAptSearches = this.recentAptSearches.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_APT_SEARCHES_KEY, JSON.stringify(this.recentAptSearches));
  }

  saveRecentJobSearch(): void {
    const search: RecentJobSearch = {
      keyword: this.scrapeKeyword,
      city: this.scrapeJobCities.join(', '),
      cities: [...this.scrapeJobCities],
      date: new Date().toISOString(),
    };
    this.recentJobSearches = this.recentJobSearches.filter(
      (s) => !(s.keyword.toLowerCase() === this.scrapeKeyword.toLowerCase() && s.city.toLowerCase() === search.city.toLowerCase())
    );
    this.recentJobSearches.unshift(search);
    this.recentJobSearches = this.recentJobSearches.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_JOB_SEARCHES_KEY, JSON.stringify(this.recentJobSearches));
  }

  applyRecentAptSearch(search: RecentApartmentSearch): void {
    this.scrapeCities = search.cities || (search.city ? [search.city] : []);
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
    this.scrapeJobCities = search.cities || (search.city ? [search.city] : []);
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
