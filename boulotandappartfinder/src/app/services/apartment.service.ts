import { Injectable, isDevMode } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Apartment {
  id: number;
  title: string;
  address: string;
  city: string;
  price: number;
  surface: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  type: string;
  description: string;
  image: string;
  url: string;
  source: string;
  status: 'nouveau' | 'contacte' | 'visite' | 'supprime';
  rating?: number;
  favorite: number;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface ScrapeFilters {
  city: string;
  minPrice?: number;
  maxPrice?: number;
  propertyTypes?: string[];
  minRooms?: number;
  maxRooms?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minSurface?: number;
  maxSurface?: number;
  minLandSurface?: number;
  maxLandSurface?: number;
  furnished?: string;
}

export interface ApartmentFilters {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  type?: string;
  bedrooms?: number;
  bathrooms?: number;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class ApartmentService {
  private readonly apiUrl = isDevMode() ? 'http://localhost:3000/api' : '/api';

  constructor(private http: HttpClient) {}

  getAll(filters?: ApartmentFilters): Observable<Apartment[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      });
    }
    return this.http.get<Apartment[]>(`${this.apiUrl}/apartments`, { params });
  }

  updateStatus(id: number, status: string): Observable<{ id: number; status: string }> {
    return this.http.patch<{ id: number; status: string }>(
      `${this.apiUrl}/apartments/${id}/status`,
      { status }
    );
  }

  delete(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/apartments/${id}`);
  }

  toggleFavorite(id: number): Observable<{ id: number; favorite: number }> {
    return this.http.patch<{ id: number; favorite: number }>(
      `${this.apiUrl}/apartments/${id}/favorite`,
      {}
    );
  }

  scrape(filters: ScrapeFilters): Observable<{ message: string; count: number }> {
    return this.http.post<{ message: string; count: number }>(
      `${this.apiUrl}/scrape/apartments`,
      filters
    );
  }
}
