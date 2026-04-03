import { Component, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JobService, Job } from '../../services/job.service';

interface Filters {
  keyword: string;
  city: string;
  sector: string;
  minSalary: number;
  remote: string;
  experience: string;
}

@Component({
  selector: 'app-job-search',
  imports: [FormsModule],
  templateUrl: './job-search.html',
  styleUrl: './job-search.scss',
})
export class JobSearch implements OnInit {
  filters: Filters = {
    keyword: '',
    city: '',
    sector: '',
    minSalary: 25000,
    remote: '',
    experience: '',
  };

  readonly results = signal<Job[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);

  constructor(private jobService: JobService) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading.set(true);
    const filters: Record<string, string | number> = {};
    if (this.filters.keyword) filters['keyword'] = this.filters.keyword;
    if (this.filters.city) filters['city'] = this.filters.city;
    if (this.filters.sector) filters['sector'] = this.filters.sector;
    if (this.filters.minSalary > 25000) filters['minSalary'] = this.filters.minSalary;
    if (this.filters.remote) filters['remote'] = this.filters.remote;
    if (this.filters.experience) filters['experience'] = this.filters.experience;

    this.jobService.getAll(filters).subscribe({
      next: (data) => {
        this.results.set(data);
        this.totalCount.set(data.length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFilterChange(): void {
    this.loadJobs();
  }

  updateStatus(job: Job, status: string): void {
    this.jobService.updateStatus(job.id, status).subscribe(() => {
      if (status === 'supprime') {
        this.results.update((list) => list.filter((j) => j.id !== job.id));
      } else {
        this.results.update((list) =>
          list.map((j) => (j.id === job.id ? { ...j, status: status as Job['status'] } : j))
        );
      }
    });
  }

  toggleFavorite(job: Job): void {
    this.jobService.toggleFavorite(job.id).subscribe((res) => {
      this.results.update((list) =>
        list.map((j) => (j.id === job.id ? { ...j, favorite: res.favorite } : j))
      );
    });
  }

  confirmDelete(job: Job): void {
    if (confirm('Supprimer cette offre ?')) {
      this.updateStatus(job, 'supprime');
    }
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

  getPostedLabel(dateStr: string): string {
    const posted = new Date(dateStr);
    const now = new Date();
    const days = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    return `Il y a ${days}j`;
  }

  reset(): void {
    this.filters = {
      keyword: '',
      city: '',
      sector: '',
      minSalary: 25000,
      remote: '',
      experience: '',
    };
    this.loadJobs();
  }
}
