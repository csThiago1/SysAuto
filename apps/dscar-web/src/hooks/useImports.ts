import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/imports';

export const importKeys = {
  all: ['imports'] as const,
  attempts: (params: Record<string, unknown> = {}) =>
    [...importKeys.all, 'attempts', params] as const,
};

export function useImportAttempts(params: { casualty_number?: string; parsed_ok?: boolean } = {}) {
  return useQuery({
    queryKey: importKeys.attempts(params),
    queryFn: () => api.listAttempts(params),
    refetchInterval: 30_000,  // polling do histórico enquanto a página está aberta
  });
}

export function useFetchCilia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.fetchCilia,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: importKeys.all });
      qc.invalidateQueries({ queryKey: ['service-orders'] });
    },
  });
}

export function useUploadXmlIfx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.uploadXmlIfx,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: importKeys.all });
      qc.invalidateQueries({ queryKey: ['service-orders'] });
    },
  });
}
