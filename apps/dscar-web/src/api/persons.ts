import { apiRequest } from './client';

export interface APIPerson {
  id: number;
  full_name: string;
  person_type: 'CLIENT' | 'EMPLOYEE' | 'INSURER' | 'BROKER';
  phone: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function listPersons(params?: {
  person_type?: string;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<APIPerson>> {
  const query = new URLSearchParams();
  if (params?.person_type) query.set('person_type', params.person_type);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  return apiRequest<PaginatedResponse<APIPerson>>(`/persons/?${query.toString()}`);
}

export async function createPerson(data: Omit<APIPerson, 'id' | 'is_active' | 'created_at'>): Promise<APIPerson> {
  return apiRequest<APIPerson>('/persons/', { method: 'POST', body: JSON.stringify(data) });
}

export async function getPerson(id: number): Promise<APIPerson> {
  return apiRequest<APIPerson>(`/persons/${id}/`);
}
