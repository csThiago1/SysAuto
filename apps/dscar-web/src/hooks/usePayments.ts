// apps/dscar-web/src/hooks/usePayments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/payments';
import { soKeys } from './useServiceOrderV2';

export function usePayments(serviceOrderId: number | null) {
  return useQuery({
    queryKey: [...soKeys.detail(serviceOrderId ?? 0), 'payments'],
    queryFn: () => api.listPayments(serviceOrderId!),
    enabled: serviceOrderId !== null,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: { serviceOrderId: number } & Parameters<typeof api.recordPayment>[1],
    ) => {
      const { serviceOrderId, ...data } = input;
      return api.recordPayment(serviceOrderId, data);
    },
    onSuccess: (_, { serviceOrderId }) => {
      qc.invalidateQueries({ queryKey: [...soKeys.detail(serviceOrderId), 'payments'] });
      qc.invalidateQueries({ queryKey: soKeys.events(serviceOrderId) });
    },
  });
}
