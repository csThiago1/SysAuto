import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OSLaborItem {
  id: string;
  description: string;
  service_catalog: string | null;
  service_catalog_name: string | null;
  quantity: number;
  unit_price: string;
  discount: string;
  total: string;
  source_type: string;
}

interface AddLaborPayload {
  description: string;
  service_catalog?: string | null;
  quantity?: number;
  unit_price: string;
  discount?: string;
}

export function useOSLabor(osId: string) {
  return useQuery<OSLaborItem[]>({
    queryKey: ['service-order', osId, 'labor'],
    queryFn: () => api.get<OSLaborItem[]>(`/service-orders/${osId}/labor`),
    enabled: !!osId,
  });
}

export function useAddOSLabor(osId: string) {
  const qc = useQueryClient();
  return useMutation<OSLaborItem, Error, AddLaborPayload>({
    mutationFn: (payload) =>
      api.post<OSLaborItem>(`/service-orders/${osId}/labor`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'labor'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}

export function useUpdateOSLabor(osId: string) {
  const qc = useQueryClient();
  return useMutation<OSLaborItem, Error, { itemId: string; payload: Partial<AddLaborPayload> }>({
    mutationFn: ({ itemId, payload }) =>
      api.patch<OSLaborItem>(`/service-orders/${osId}/labor/${itemId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'labor'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}

export function useDeleteOSLabor(osId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (itemId) =>
      api.delete(`/service-orders/${osId}/labor/${itemId}`) as Promise<void>,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'labor'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}
