import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApartmentService, Apartment } from '../../services/apartment.service';

interface Filters {
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

  constructor(private apartmentService: ApartmentService) {}

  ngOnInit(): void {
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

  toggleFavorite(apt: Apartment): void {
    this.apartmentService.toggleFavorite(apt.id).subscribe((res) => {
      this.results.update((list) =>
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
