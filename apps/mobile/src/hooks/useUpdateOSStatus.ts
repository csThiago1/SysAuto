import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import { api } from '@/lib/api';
import { database } from '@/db/index';
import { ServiceOrder } from '@/db/models/ServiceOrder';
import { serviceOrderKeys } from './useServiceOrders';
import type { ServiceOrderStatus } from '@paddock/types';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUpdateOSStatus(osId: string): {
  update: (newStatus: ServiceOrderStatus) => Promise<void>;
  isUpdating: boolean;
  error: string | null;
} {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const update = async (newStatus: ServiceOrderStatus): Promise<void> => {
    setIsUpdating(true);
    setError(null);
    try {
      await api.patch(`/service-orders/${osId}/`, { status: newStatus });

      // Atualiza WatermelonDB para que a lista reaja imediatamente (sem aguardar sync)
      const collection = database.get<ServiceOrder>('service_orders');
      const records = await collection.query(Q.where('remote_id', osId)).fetch();
      if (records.length > 0) {
        await database.write(async () => {
          await records[0].update((r) => {
            r.status = newStatus;
          });
        });
      }

      // Invalida cache TanStack Query para refetch do detalhe (transition_logs etc.)
      await queryClient.invalidateQueries({ queryKey: serviceOrderKeys.detail(osId) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar status';
      setError(msg);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  return { update, isUpdating, error };
}
