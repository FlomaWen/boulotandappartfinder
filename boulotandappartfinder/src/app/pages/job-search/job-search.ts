import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface JobFilters {
  keyword: string;
  city: string;
  sector: string;
  minSalary: number | null;
  remote: string;
}

interface Job {
  title: string;
  company: string;
  city: string;
  sector: string;
  salary: string;
  salaryMin: number;
  remote: string;
  description: string;
}

@Component({
  selector: 'app-job-search',
  imports: [FormsModule],
  templateUrl: './job-search.html',
  styleUrl: './job-search.scss',
})
export class JobSearch {
  filters: JobFilters = {
    keyword: '',
    city: '',
    sector: '',
    minSalary: null,
    remote: '',
  };

  readonly results = signal<Job[]>([]);
  readonly hasSearched = signal(false);

  private readonly mockData: Job[] = [
    {
      title: 'Developpeur Full Stack',
      company: 'TechCorp',
      city: 'Paris',
      sector: 'Tech',
      salary: '42k - 50k',
      salaryMin: 42000,
      remote: 'Hybride',
      description: 'Rejoignez notre equipe pour developper des applications web modernes.',
    },
    {
      title: 'Chef de Projet Digital',
      company: 'AgenceWeb',
      city: 'Lyon',
      sector: 'Digital',
      salary: '38k - 45k',
      salaryMin: 38000,
      remote: 'Presentiel',
      description: 'Gestion de projets digitaux pour des clients grands comptes.',
    },
    {
      title: 'Data Analyst',
      company: 'DataVision',
      city: 'Bordeaux',
      sector: 'Tech',
      salary: '35k - 42k',
      salaryMin: 35000,
      remote: 'Full remote',
      description: 'Analyse de donnees et creation de dashboards pour la direction.',
    },
    {
      title: 'Commercial B2B',
      company: 'VentePro',
      city: 'Paris',
      sector: 'Commerce',
      salary: '30k - 40k + variable',
      salaryMin: 30000,
      remote: 'Presentiel',
      description: 'Developpement du portefeuille clients en Ile-de-France.',
    },
    {
      title: 'Ingenieur DevOps',
      company: 'CloudFirst',
      city: 'Nantes',
      sector: 'Tech',
      salary: '45k - 55k',
      salaryMin: 45000,
      remote: 'Hybride',
      description: 'Mise en place et maintien des pipelines CI/CD et infrastructure cloud.',
    },
    {
      title: 'Comptable Senior',
      company: 'FinanceExpert',
      city: 'Toulouse',
      sector: 'Finance',
      salary: '35k - 42k',
      salaryMin: 35000,
      remote: 'Presentiel',
      description: 'Gestion de la comptabilite generale et analytique.',
    },
  ];

  search(): void {
    this.hasSearched.set(true);
    const filtered = this.mockData.filter((job) => {
      if (this.filters.keyword) {
        const kw = this.filters.keyword.toLowerCase();
        if (!job.title.toLowerCase().includes(kw) && !job.description.toLowerCase().includes(kw)) return false;
      }
      if (this.filters.city && !job.city.toLowerCase().includes(this.filters.city.toLowerCase())) return false;
      if (this.filters.sector && job.sector !== this.filters.sector) return false;
      if (this.filters.minSalary && job.salaryMin < this.filters.minSalary) return false;
      if (this.filters.remote && job.remote !== this.filters.remote) return false;
      return true;
    });
    this.results.set(filtered);
  }

  reset(): void {
    this.filters = { keyword: '', city: '', sector: '', minSalary: null, remote: '' };
    this.results.set([]);
    this.hasSearched.set(false);
  }
}
