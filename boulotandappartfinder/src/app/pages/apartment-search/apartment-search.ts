import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApartmentService, Apartment, ScrapeFilters } from '../../services/apartment.service';

interface Filters {
  city: string;
  priceRange: string;
  minPrice: number;
  maxPrice: number;
  type: string;
  bedrooms: string;
  bathrooms: string;
}

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

const RECENT_APT_SEARCHES_KEY = 'recentApartmentSearches';
const MAX_RECENT_SEARCHES = 5;

@Component({
  selector: 'app-apartment-search',
  imports: [FormsModule],
  templateUrl: './apartment-search.html',
  styleUrl: './apartment-search.scss',
})
export class ApartmentSearch implements OnInit {
  filters: Filters = {
    city: '',
    priceRange: 'custom',
    minPrice: 300,
    maxPrice: 2000,
    type: '',
    bedrooms: '',
    bathrooms: '',
  };

  readonly results = signal<Apartment[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly scraping = signal(false);

  scrapeCity = '';
  scrapeMinPrice: number | null = null;
  scrapeMaxPrice: number | null = null;
  scrapePropertyTypes: PropertyTypes = {
    appartement: true,
    maison: false,
    terrain: false,
    parking: false,
    autre: false,
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

  recentSearches: RecentApartmentSearch[] = [];

  constructor(private apartmentService: ApartmentService) {}

  ngOnInit(): void {
    this.loadRecentSearches();
    this.loadApartments();
  }

  loadApartments(): void {
    this.loading.set(true);
    const filters: Record<string, string | number> = {};
    if (this.filters.city) filters['city'] = this.filters.city;
    if (this.filters.priceRange !== 'custom') {
      if (this.filters.minPrice) filters['minPrice'] = this.filters.minPrice;
      if (this.filters.maxPrice) filters['maxPrice'] = this.filters.maxPrice;
    }
    if (this.filters.type) filters['type'] = this.filters.type;
    if (this.filters.bedrooms) filters['bedrooms'] = +this.filters.bedrooms;
    if (this.filters.bathrooms) filters['bathrooms'] = +this.filters.bathrooms;

    this.apartmentService.getAll(filters).subscribe({
      next: (data) => {
        this.results.set(data);
        this.totalCount.set(data.length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPriceRangeChange(): void {
    if (this.filters.priceRange === '500-1000') {
      this.filters.minPrice = 500;
      this.filters.maxPrice = 1000;
    } else if (this.filters.priceRange === '1000+') {
      this.filters.minPrice = 1000;
      this.filters.maxPrice = 2000;
    }
    this.loadApartments();
  }

  onFilterChange(): void {
    this.loadApartments();
  }

  updateStatus(apt: Apartment, status: string): void {
    this.apartmentService.updateStatus(apt.id, status).subscribe(() => {
      if (status === 'supprime') {
        this.results.update((list) => list.filter((a) => a.id !== apt.id));
      } else {
        this.results.update((list) =>
          list.map((a) => (a.id === apt.id ? { ...a, status: status as Apartment['status'] } : a))
        );
      }
    });
  }

  confirmDelete(apt: Apartment): void {
    if (confirm('Supprimer cette annonce ?')) {
      this.updateStatus(apt, 'supprime');
    }
  }

  openUrl(url: string): void {
    window.open(url, '_blank');
  }

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

  scrapeApartments(): void {
    if (!this.scrapeCity) return;
    this.scraping.set(true);

    const selectedTypes = Object.entries(this.scrapePropertyTypes)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    const scrapeFilters: ScrapeFilters = {
      city: this.scrapeCity,
    };

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
        this.scraping.set(false);
        this.saveRecentSearch();
        this.loadApartments();
        alert(`${res.count} nouvelles annonces importees !`);
      },
      error: (err) => {
        this.scraping.set(false);
        alert('Erreur de scraping: ' + (err.error?.details || err.message));
      },
    });
  }

  loadRecentSearches(): void {
    try {
      const stored = localStorage.getItem(RECENT_APT_SEARCHES_KEY);
      this.recentSearches = stored ? JSON.parse(stored) : [];
    } catch {
      this.recentSearches = [];
    }
  }

  saveRecentSearch(): void {
    const search: RecentApartmentSearch = {
      city: this.scrapeCity,
      minPrice: this.scrapeMinPrice,
      maxPrice: this.scrapeMaxPrice,
      propertyTypes: { ...this.scrapePropertyTypes },
      minRooms: this.scrapeMinRooms,
      maxRooms: this.scrapeMaxRooms,
      minBedrooms: this.scrapeMinBedrooms,
      maxBedrooms: this.scrapeMaxBedrooms,
      minSurface: this.scrapeMinSurface,
      maxSurface: this.scrapeMaxSurface,
      minLandSurface: this.scrapeMinLandSurface,
      maxLandSurface: this.scrapeMaxLandSurface,
      furnished: this.scrapeFurnished,
      date: new Date().toISOString(),
    };
    // Remove duplicate by city (same city = same search intent)
    this.recentSearches = this.recentSearches.filter(
      (s) => s.city.toLowerCase() !== this.scrapeCity.toLowerCase()
    );
    this.recentSearches.unshift(search);
    this.recentSearches = this.recentSearches.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_APT_SEARCHES_KEY, JSON.stringify(this.recentSearches));
  }

  applyRecentSearch(search: RecentApartmentSearch): void {
    this.scrapeCity = search.city;
    this.scrapeMinPrice = search.minPrice;
    this.scrapeMaxPrice = search.maxPrice;
    this.scrapePropertyTypes = { ...search.propertyTypes };
    this.scrapeMinRooms = search.minRooms;
    this.scrapeMaxRooms = search.maxRooms;
    this.scrapeMinBedrooms = search.minBedrooms;
    this.scrapeMaxBedrooms = search.maxBedrooms;
    this.scrapeMinSurface = search.minSurface;
    this.scrapeMaxSurface = search.maxSurface;
    this.scrapeMinLandSurface = search.minLandSurface;
    this.scrapeMaxLandSurface = search.maxLandSurface;
    this.scrapeFurnished = search.furnished;
  }

  removeRecentSearch(index: number, event: Event): void {
    event.stopPropagation();
    this.recentSearches.splice(index, 1);
    localStorage.setItem(RECENT_APT_SEARCHES_KEY, JSON.stringify(this.recentSearches));
  }

  getSelectedTypes(types: PropertyTypes): string {
    return Object.entries(types)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(', ') || 'tous';
  }

  reset(): void {
    this.filters = {
      city: '',
      priceRange: 'custom',
      minPrice: 300,
      maxPrice: 2000,
      type: '',
      bedrooms: '',
      bathrooms: '',
    };
    this.loadApartments();
  }
}
