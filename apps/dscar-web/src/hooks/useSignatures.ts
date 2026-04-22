import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/signatures';

export const signatureKeys = {
  all: ['signatures'] as const,
  list: (params: Record<string, unknown> = {}) =>
    [...signatureKeys.all, 'list', params] as const,
  detail: (id: number) => [...signatureKeys.all, 'detail', id] as const,
};

export function useSignatures(params: { service_order?: number; budget?: number } = {}) {
  return useQuery({
    queryKey: signatureKeys.list(params),
    queryFn: () => api.listSignatures(params),
    enabled: params.service_order !== undefined || params.budget !== undefined,
  });
}

export function useSignature(id: number | null) {
  return useQuery({
    queryKey: signatureKeys.detail(id ?? 0),
    queryFn: () => api.getSignature(id!),
    enabled: id !== null,
  });
}

export function useCaptureSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.captureSignature,
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: signatureKeys.all });
      if (input.service_order_id) {
        qc.invalidateQueries({ queryKey: ['service-orders', 'detail', input.service_order_id] });
      }
    },
  });
}
