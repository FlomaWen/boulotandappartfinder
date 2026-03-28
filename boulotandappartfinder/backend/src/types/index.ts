export type ApartmentStatus = 'nouveau' | 'contacte' | 'visite' | 'supprime';
export type JobStatus = 'nouveau' | 'postule' | 'entretien' | 'supprime';

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
  status: ApartmentStatus;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

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
  tags: string;
  url: string;
  source: string;
  status: JobStatus;
  color: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}
