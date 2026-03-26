import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { ApartmentSearch } from './pages/apartment-search/apartment-search';
import { JobSearch } from './pages/job-search/job-search';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'appartements', component: ApartmentSearch },
  { path: 'emplois', component: JobSearch },
  { path: '**', redirectTo: '' },
];
