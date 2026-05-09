import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast.store';
import { serviceOrderKeys } from './useServiceOrders';
import type {
  TransitionOverrideRequest,
  CreateOverridePayload,
  ResolveOverridePayload,
  TransitionPayload,
} from '@paddock/types';

// ─── useTransitionWithValidation ─────────────────────────────────────────────
// Executa a transição de status com suporte a force/override presencial.
// Lança a resposta bruta de erro para que o caller possa inspecionar os bloqueios.

export function useTransitionWithValidation(osId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TransitionPayload) => {
      return api.post<unknown>(`/service-orders/${osId}/transition/`, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: serviceOrderKeys.all });
      void qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(osId) });
    },
    // Não usar onError aqui — o caller do sheet precisa inspecionar o erro
  });
}

// ─── useRequestOverride ───────────────────────────────────────────────────────
// Cria um TransitionOverrideRequest assíncrono (Canal 2/3 do spec).

export function useRequestOverride(osId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateOverridePayload) => {
      return api.post<TransitionOverrideRequest>(
        `/service-orders/${osId}/override-request/`,
        payload,
      );
    },
    onSuccess: () => {
      toast.success('Solicitação enviada ao gerente');
      void qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(osId) });
    },
    onError: () => {
      toast.error('Erro ao solicitar liberação');
    },
  });
}

// ─── usePendingOverrides ──────────────────────────────────────────────────────
// Lista overrides pendentes — usado na tela de aprovação do gerente.
// Refresca a cada 30 s enquanto o componente estiver montado.

export function usePendingOverrides() {
  return useQuery<TransitionOverrideRequest[]>({
    queryKey: ['pending-overrides'],
    queryFn: async () => {
      return api.get<TransitionOverrideRequest[]>('/service-orders/pending-overrides/');
    },
    refetchInterval: 30_000,
  });
}

// ─── useResolveOverride ───────────────────────────────────────────────────────
// Aprova ou rejeita um override pendente (MANAGER+).

export function useResolveOverride(osId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      overrideId,
      payload,
    }: {
      overrideId: string;
      payload: ResolveOverridePayload;
    }) => {
      return api.post<TransitionOverrideRequest>(
        `/service-orders/${osId}/override-request/${overrideId}/resolve/`,
        payload,
      );
    },
    onSuccess: (_, vars) => {
      const label = vars.payload.action === 'approved' ? 'aprovado' : 'rejeitado';
      toast.success(`Override ${label}`);
      void qc.invalidateQueries({ queryKey: serviceOrderKeys.all });
      void qc.invalidateQueries({ queryKey: serviceOrderKeys.detail(osId) });
      void qc.invalidateQueries({ queryKey: ['pending-overrides'] });
    },
    onError: () => {
      toast.error('Erro ao resolver override');
    },
  });
}
