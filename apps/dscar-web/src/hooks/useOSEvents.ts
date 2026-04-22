// apps/dscar-web/src/hooks/useOSEvents.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/serviceOrdersV2';
import { soKeys } from './useServiceOrderV2';

export function useOSEvents(id: number | null, eventType?: string) {
  return useQuery({
    queryKey: [...soKeys.events(id ?? 0), eventType ?? 'all'],
    queryFn: () => api.listEvents(id!, eventType),
    enabled: id !== null,
  });
}

export function useOSPareceres(id: number | null) {
  return useQuery({
    queryKey: soKeys.pareceres(id ?? 0),
    queryFn: () => api.listPareceres(id!),
    enabled: id !== null,
  });
}

export function useAddParecer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; body: string; parecerType?: string }) =>
      api.addInternalParecer(input.id, input.body, input.parecerType),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: soKeys.pareceres(id) });
      qc.invalidateQueries({ queryKey: soKeys.events(id) });
    },
  });
}
