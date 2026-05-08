import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OSPart {
  id: string;
  description: string;
  part_number: string;
  panel: string;
  quantity: number;
  unit_price: string;
  discount: string;
  subtotal: string;
  tipo_qualidade: string;
  source_type: string;
  source_type_display: string;
  status_peca: string;
  origem: string;
}

interface AddPartPayload {
  description: string;
  panel?: string;
  quantity: number;
  unit_price: string;
  discount?: string;
  tipo_qualidade?: string;
}

export function useOSParts(osId: string) {
  return useQuery<OSPart[]>({
    queryKey: ['service-order', osId, 'parts'],
    queryFn: () => api.get<OSPart[]>(`/service-orders/${osId}/parts`),
    enabled: !!osId,
  });
}

export function useAddOSPart(osId: string) {
  const qc = useQueryClient();
  return useMutation<OSPart, Error, AddPartPayload>({
    mutationFn: (payload) =>
      api.post<OSPart>(`/service-orders/${osId}/parts`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'parts'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}

export function useUpdateOSPart(osId: string) {
  const qc = useQueryClient();
  return useMutation<OSPart, Error, { partId: string; payload: Partial<AddPartPayload> }>({
    mutationFn: ({ partId, payload }) =>
      api.patch<OSPart>(`/service-orders/${osId}/parts/${partId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'parts'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}

export function useDeleteOSPart(osId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (partId) =>
      api.delete(`/service-orders/${osId}/parts/${partId}`) as Promise<void>,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'parts'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}
