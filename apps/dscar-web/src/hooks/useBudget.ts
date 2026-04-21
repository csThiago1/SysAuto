// apps/dscar-web/src/hooks/useBudget.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/budgets';

export const budgetKeys = {
  all: ['budgets'] as const,
  lists: () => [...budgetKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...budgetKeys.lists(), params] as const,
  details: () => [...budgetKeys.all, 'detail'] as const,
  detail: (id: number) => [...budgetKeys.details(), id] as const,
};

export function useBudgets(params: { search?: string; customer?: number; page?: number } = {}) {
  return useQuery({
    queryKey: budgetKeys.list(params),
    queryFn: () => api.listBudgets(params),
  });
}

export function useBudget(id: number | null) {
  return useQuery({
    queryKey: budgetKeys.detail(id ?? 0),
    queryFn: () => api.getBudget(id!),
    enabled: id !== null,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBudget,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
    },
  });
}

export function useSendBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, versionId }: { budgetId: number; versionId: number }) =>
      api.sendBudgetVersion(budgetId, versionId),
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
    },
  });
}

export function useApproveBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      budgetId: number;
      versionId: number;
      approved_by: string;
      evidence_s3_key?: string;
    }) =>
      api.approveBudgetVersion(input.budgetId, input.versionId, {
        approved_by: input.approved_by,
        evidence_s3_key: input.evidence_s3_key,
      }),
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
      qc.invalidateQueries({ queryKey: ['service-orders'] });
    },
  });
}

export function useRejectBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, versionId }: { budgetId: number; versionId: number }) =>
      api.rejectBudgetVersion(budgetId, versionId),
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
    },
  });
}

export function useReviseBudgetVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ budgetId, versionId }: { budgetId: number; versionId: number }) =>
      api.reviseBudgetVersion(budgetId, versionId),
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
    },
  });
}

export function useCreateBudgetItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Parameters<typeof api.createBudgetItem>[2] & {
        budgetId: number;
        versionId: number;
      },
    ) => {
      const { budgetId, versionId, ...data } = input;
      return api.createBudgetItem(budgetId, versionId, data);
    },
    onSuccess: (_, { budgetId }) => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) });
    },
  });
}

export function useCloneBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.cloneBudget(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.lists() });
    },
  });
}
