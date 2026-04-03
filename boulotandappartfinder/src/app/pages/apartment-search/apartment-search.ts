import { Component, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApartmentService, Apartment } from '../../services/apartment.service';

interface Filters {
  statusGroup: string;
  city: string;
  priceRange: string;
  minPrice: number;
  maxPrice: number;
  type: string;
  bedrooms: string;
  bathrooms: string;
}

@Component({
  selector: 'app-apartment-search',
  imports: [FormsModule],
  templateUrl: './apartment-search.html',
  styleUrl: './apartment-search.scss',
})
export class ApartmentSearch implements OnInit {
  filters: Filters = {
    statusGroup: '',
    city: '',
    priceRange: 'custom',
    minPrice: 300,
    maxPrice: 2000,
    type: '',
    bedrooms: '',
    bathrooms: '',
  };

  readonly allResults = signal<Apartment[]>([]);
  readonly loading = signal(false);
  readonly currentPage = signal(1);
  readonly pageSize = 20;

  readonly totalCount = computed(() => this.allResults().length);
  readonly totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize));
  readonly results = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.allResults().slice(start, start + this.pageSize);
  });

  constructor(private apartmentService: ApartmentService) {}

  ngOnInit(): void {
    this.loadApartments();
  }

  loadApartments(): void {
    this.loading.set(true);
    this.currentPage.set(1);
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
        let filtered = data;
        if (this.filters.statusGroup === 'nouveau') {
          filtered = data.filter((apt) => apt.status === 'nouveau');
        } else if (this.filters.statusGroup === 'en_cours') {
          filtered = data.filter((apt) => apt.status === 'contacte' || apt.status === 'visite');
        }
        this.allResults.set(filtered);
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
        this.allResults.update((list) => list.filter((a) => a.id !== apt.id));
      } else {
        this.allResults.update((list) =>
          list.map((a) => (a.id === apt.id ? { ...a, status: status as Apartment['status'] } : a))
        );
      }
    });
  }

  toggleFavorite(apt: Apartment): void {
    this.apartmentService.toggleFavorite(apt.id).subscribe((res) => {
      this.allResults.update((list) =>
        list.map((a) => (a.id === apt.id ? { ...a, favorite: res.favorite } : a))
      );
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

  reset(): void {
    this.filters = {
      statusGroup: '',
      city: '',
      priceRange: 'custom',
      minPrice: 300,
      maxPrice: 2000,
      type: '',
      bedrooms: '',
      bathrooms: '',
    };
    this.currentPage.set(1);
    this.loadApartments();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push(-1);
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
      }
      if (current < total - 2) pages.push(-1);
      pages.push(total);
    }
    return pages;
  }
}
