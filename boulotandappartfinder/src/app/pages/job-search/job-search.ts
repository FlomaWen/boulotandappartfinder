import { Component, signal, computed, OnInit } from '@angular/core';
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

  readonly allResults = signal<Job[]>([]);
  readonly loading = signal(false);
  readonly currentPage = signal(1);
  readonly pageSize = 20;

  readonly totalCount = computed(() => this.allResults().length);
  readonly totalPages = computed(() => Math.ceil(this.totalCount() / this.pageSize));
  readonly results = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.allResults().slice(start, start + this.pageSize);
  });

  constructor(private jobService: JobService) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading.set(true);
    this.currentPage.set(1);
    const filters: Record<string, string | number> = {};
    if (this.filters.keyword) filters['keyword'] = this.filters.keyword;
    if (this.filters.city) filters['city'] = this.filters.city;
    if (this.filters.sector) filters['sector'] = this.filters.sector;
    if (this.filters.minSalary > 25000) filters['minSalary'] = this.filters.minSalary;
    if (this.filters.remote) filters['remote'] = this.filters.remote;
    if (this.filters.experience) filters['experience'] = this.filters.experience;

    this.jobService.getAll(filters).subscribe({
      next: (data) => {
        this.allResults.set(data);
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
        this.allResults.update((list) => list.filter((j) => j.id !== job.id));
      } else {
        this.allResults.update((list) =>
          list.map((j) => (j.id === job.id ? { ...j, status: status as Job['status'] } : j))
        );
      }
    });
  }

  toggleFavorite(job: Job): void {
    this.jobService.toggleFavorite(job.id).subscribe((res) => {
      this.allResults.update((list) =>
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
    this.currentPage.set(1);
    this.loadJobs();
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
