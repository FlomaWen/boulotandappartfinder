import { Component, signal, OnInit } from '@angular/core';
import { ApartmentService, Apartment } from '../../services/apartment.service';
import { JobService, Job } from '../../services/job.service';

@Component({
  selector: 'app-favorites',
  imports: [],
  templateUrl: './favorites.html',
  styleUrl: './favorites.scss',
})
export class Favorites implements OnInit {
  readonly apartments = signal<Apartment[]>([]);
  readonly jobs = signal<Job[]>([]);
  readonly loading = signal(false);

  activeTab: 'apartments' | 'jobs' = 'apartments';

  constructor(
    private apartmentService: ApartmentService,
    private jobService: JobService,
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
  }

  loadFavorites(): void {
    this.loading.set(true);
    this.apartmentService.getAll({ favorite: 1 } as any).subscribe({
      next: (data) => {
        this.apartments.set(data.filter((a) => a.favorite));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.jobService.getAll({ favorite: 1 } as any).subscribe({
      next: (data) => {
        this.jobs.set(data.filter((j) => j.favorite));
      },
    });
  }

  removeFavorite(apt: Apartment): void {
    this.apartmentService.toggleFavorite(apt.id).subscribe(() => {
      this.apartments.update((list) => list.filter((a) => a.id !== apt.id));
    });
  }

  removeJobFavorite(job: Job): void {
    this.jobService.toggleFavorite(job.id).subscribe(() => {
      this.jobs.update((list) => list.filter((j) => j.id !== job.id));
    });
  }

  openUrl(url: string): void {
    window.open(url, '_blank');
  }

  getInitials(company: string): string {
    return company
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }
}
