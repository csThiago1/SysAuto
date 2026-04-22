// apps/dscar-web/src/hooks/useServiceOrderV2.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/serviceOrdersV2';

export const soKeys = {
  all: ['service-orders'] as const,
  lists: () => [...soKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...soKeys.lists(), params] as const,
  detail: (id: number) => [...soKeys.all, 'detail', id] as const,
  events: (id: number) => [...soKeys.all, id, 'events'] as const,
  pareceres: (id: number) => [...soKeys.all, id, 'pareceres'] as const,
};

export function useServiceOrdersV2(
  params: {
    search?: string;
    customer_type?: string;
    status?: string;
    page?: number;
  } = {},
) {
  return useQuery({
    queryKey: soKeys.list(params),
    queryFn: () => api.listServiceOrdersV2(params),
  });
}

export function useServiceOrderV2(id: number | null) {
  return useQuery({
    queryKey: soKeys.detail(id ?? 0),
    queryFn: () => api.getServiceOrder(id!),
    enabled: id !== null,
  });
}

export function useChangeStatusV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; newStatus: string; notes?: string }) =>
      api.changeStatusV2(input.id, input.newStatus, input.notes),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: soKeys.detail(id) });
      qc.invalidateQueries({ queryKey: soKeys.events(id) });
      qc.invalidateQueries({ queryKey: soKeys.lists() });
    },
  });
}

export function useAddComplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: number;
      items: Parameters<typeof api.addComplement>[1];
      approvedBy: string;
    }) => api.addComplement(input.id, input.items, input.approvedBy),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: soKeys.detail(id) });
      qc.invalidateQueries({ queryKey: soKeys.events(id) });
    },
  });
}

export function useApproveVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { serviceOrderId: number; versionId: number }) =>
      api.approveVersion(input.serviceOrderId, input.versionId),
    onSuccess: (_, { serviceOrderId }) => {
      qc.invalidateQueries({ queryKey: soKeys.detail(serviceOrderId) });
      qc.invalidateQueries({ queryKey: soKeys.events(serviceOrderId) });
    },
  });
}
