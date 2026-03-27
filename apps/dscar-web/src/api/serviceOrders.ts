import { OSStatus } from '../types';
import { apiRequest } from './client';

export interface APIServiceOrder {
  id: number;
  os_number: string;
  customer: number;
  vehicle_plate: string;
  vehicle_description: string;
  status: OSStatus;
  total_value: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  status_history: Array<{
    from_status: OSStatus;
    to_status: OSStatus;
    changed_by: string;
    notes: string;
    changed_at: string;
  }>;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function listServiceOrders(params?: {
  status?: OSStatus;
  search?: string;
  page?: number;
}): Promise<PaginatedResponse<APIServiceOrder>> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  return apiRequest<PaginatedResponse<APIServiceOrder>>(`/service-orders/?${query.toString()}`);
}

export async function createServiceOrder(data: {
  os_number: string;
  customer: number;
  vehicle_plate: string;
  vehicle_description: string;
  total_value?: number;
  notes?: string;
}): Promise<APIServiceOrder> {
  return apiRequest<APIServiceOrder>('/service-orders/', { method: 'POST', body: JSON.stringify(data) });
}

export async function changeStatus(
  id: number,
  status: OSStatus,
  changedBy = 'Sistema',
  notes = '',
): Promise<APIServiceOrder> {
  return apiRequest<APIServiceOrder>(`/service-orders/${id}/change-status/`, {
    method: 'POST',
    body: JSON.stringify({ status, changed_by: changedBy, notes }),
  });
}
