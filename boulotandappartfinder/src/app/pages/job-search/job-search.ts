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

interface RecentJobSearch {
  keyword: string;
  city: string;
  date: string;
}

const RECENT_JOB_SEARCHES_KEY = 'recentJobSearches';
const MAX_RECENT_SEARCHES = 5;

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
  readonly scraping = signal(false);

  scrapeKeyword = '';
  scrapeCity = '';

  recentSearches: RecentJobSearch[] = [];

  constructor(private jobService: JobService) {}

  ngOnInit(): void {
    this.loadRecentSearches();
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

  scrapeJobs(): void {
    if (!this.scrapeKeyword || !this.scrapeCity) return;
    this.scraping.set(true);
    this.jobService.scrape(this.scrapeKeyword, this.scrapeCity).subscribe({
      next: (res) => {
        this.scraping.set(false);
        this.saveRecentSearch(this.scrapeKeyword, this.scrapeCity);
        this.loadJobs();
        alert(`${res.count} nouvelles offres importees !`);
      },
      error: (err) => {
        this.scraping.set(false);
        alert('Erreur de scraping: ' + (err.error?.details || err.message));
      },
    });
  }

  loadRecentSearches(): void {
    try {
      const stored = localStorage.getItem(RECENT_JOB_SEARCHES_KEY);
      this.recentSearches = stored ? JSON.parse(stored) : [];
    } catch {
      this.recentSearches = [];
    }
  }

  saveRecentSearch(keyword: string, city: string): void {
    const search: RecentJobSearch = {
      keyword,
      city,
      date: new Date().toISOString(),
    };
    // Remove duplicate if exists
    this.recentSearches = this.recentSearches.filter(
      (s) => !(s.keyword.toLowerCase() === keyword.toLowerCase() && s.city.toLowerCase() === city.toLowerCase())
    );
    this.recentSearches.unshift(search);
    this.recentSearches = this.recentSearches.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_JOB_SEARCHES_KEY, JSON.stringify(this.recentSearches));
  }

  applyRecentSearch(search: RecentJobSearch): void {
    this.scrapeKeyword = search.keyword;
    this.scrapeCity = search.city;
  }

  removeRecentSearch(index: number, event: Event): void {
    event.stopPropagation();
    this.recentSearches.splice(index, 1);
    localStorage.setItem(RECENT_JOB_SEARCHES_KEY, JSON.stringify(this.recentSearches));
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
