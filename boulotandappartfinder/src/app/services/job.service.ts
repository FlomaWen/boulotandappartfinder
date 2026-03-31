import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Job {
  id: number;
  title: string;
  company: string;
  city: string;
  sector: string;
  salary: string;
  salary_min: number | null;
  remote: string;
  experience: string;
  description: string;
  tags: string[];
  url: string;
  source: string;
  status: 'nouveau' | 'postule' | 'entretien' | 'supprime';
  color: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobFilters {
  keyword?: string;
  city?: string;
  sector?: string;
  minSalary?: number;
  remote?: string;
  experience?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getAll(filters?: JobFilters): Observable<Job[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params = params.set(key, String(value));
        }
      });
    }
    return this.http.get<Job[]>(`${this.apiUrl}/jobs`, { params });
  }

  updateStatus(id: number, status: string): Observable<{ id: number; status: string }> {
    return this.http.patch<{ id: number; status: string }>(
      `${this.apiUrl}/jobs/${id}/status`,
      { status }
    );
  }

  delete(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/jobs/${id}`);
  }

  scrape(keyword: string, city: string): Observable<{ message: string; count: number }> {
    return this.http.post<{ message: string; count: number }>(
      `${this.apiUrl}/scrape/jobs`,
      { keyword, city }
    );
  }
}
