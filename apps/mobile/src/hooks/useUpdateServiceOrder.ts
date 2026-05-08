import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface UpdateOSPayload {
  customer_type?: 'insurer' | 'private';
  insurer?: string | null;
  casualty_number?: string;
  insured_type?: string;
  deductible_amount?: string;
  estimated_delivery_date?: string;
  observations?: string;
  consultant_id?: string | null;
  os_type?: string;
}

export function useUpdateServiceOrder(osId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, UpdateOSPayload>({
    mutationFn: (payload) =>
      api.patch(`/service-orders/${osId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
      void qc.invalidateQueries({ queryKey: ['service-orders'] });
    },
  });
}
