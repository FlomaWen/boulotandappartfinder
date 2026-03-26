import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ApartmentFilters {
  city: string;
  minPrice: number | null;
  maxPrice: number | null;
  minSurface: number | null;
  rooms: number | null;
  type: string;
}

interface Apartment {
  title: string;
  city: string;
  price: number;
  surface: number;
  rooms: number;
  type: string;
  description: string;
}

@Component({
  selector: 'app-apartment-search',
  imports: [FormsModule],
  templateUrl: './apartment-search.html',
  styleUrl: './apartment-search.scss',
})
export class ApartmentSearch {
  filters: ApartmentFilters = {
    city: '',
    minPrice: null,
    maxPrice: null,
    minSurface: null,
    rooms: null,
    type: '',
  };

  readonly results = signal<Apartment[]>([]);
  readonly hasSearched = signal(false);

  // Mock data for now — will be replaced by API calls later
  private readonly mockData: Apartment[] = [
    {
      title: 'Studio lumineux centre-ville',
      city: 'Paris',
      price: 850,
      surface: 25,
      rooms: 1,
      type: 'Studio',
      description: 'Beau studio renove proche metro, ideal pour une personne.',
    },
    {
      title: 'T2 avec balcon',
      city: 'Lyon',
      price: 720,
      surface: 45,
      rooms: 2,
      type: 'T2',
      description: 'Appartement T2 avec balcon et vue degagee, quartier calme.',
    },
    {
      title: 'T3 familial proche ecoles',
      city: 'Bordeaux',
      price: 950,
      surface: 70,
      rooms: 3,
      type: 'T3',
      description: 'Grand T3 ideal pour famille, a proximite des ecoles et commerces.',
    },
    {
      title: 'T2 moderne quartier gare',
      city: 'Paris',
      price: 1100,
      surface: 40,
      rooms: 2,
      type: 'T2',
      description: 'Appartement recent avec cuisine equipee, 5 min de la gare.',
    },
    {
      title: 'Studio meuble etudiant',
      city: 'Toulouse',
      price: 480,
      surface: 20,
      rooms: 1,
      type: 'Studio',
      description: 'Studio entierement meuble, parfait pour etudiant ou jeune actif.',
    },
    {
      title: 'T4 avec jardin',
      city: 'Nantes',
      price: 1200,
      surface: 90,
      rooms: 4,
      type: 'T4',
      description: 'Spacieux T4 avec jardin privatif, ideal pour famille.',
    },
  ];

  search(): void {
    this.hasSearched.set(true);
    const filtered = this.mockData.filter((apt) => {
      if (this.filters.city && !apt.city.toLowerCase().includes(this.filters.city.toLowerCase())) return false;
      if (this.filters.minPrice && apt.price < this.filters.minPrice) return false;
      if (this.filters.maxPrice && apt.price > this.filters.maxPrice) return false;
      if (this.filters.minSurface && apt.surface < this.filters.minSurface) return false;
      if (this.filters.rooms && apt.rooms !== this.filters.rooms) return false;
      if (this.filters.type && apt.type !== this.filters.type) return false;
      return true;
    });
    this.results.set(filtered);
  }

  reset(): void {
    this.filters = { city: '', minPrice: null, maxPrice: null, minSurface: null, rooms: null, type: '' };
    this.results.set([]);
    this.hasSearched.set(false);
  }
}
