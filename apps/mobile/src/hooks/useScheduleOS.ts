import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SchedulePayload {
  scheduling_date?: string;
  estimated_delivery_date?: string;
  repair_days?: number | null;
  delivery_date?: string;
}

export function useScheduleOS(osId: string) {
  const qc = useQueryClient();
  return useMutation<unknown, Error, SchedulePayload>({
    mutationFn: (payload) =>
      api.patch(`/service-orders/${osId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
      void qc.invalidateQueries({ queryKey: ['service-orders'] });
      void qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}
