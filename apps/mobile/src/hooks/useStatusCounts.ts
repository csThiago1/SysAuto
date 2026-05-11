import { useEffect, useState } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db/index';
import { ServiceOrder } from '@/db/models/ServiceOrder';

/**
 * Observa o WatermelonDB e retorna contagem de OS por status.
 * Exclui delivered/cancelled por padrão (contagem "na oficina").
 * Retorna também o total geral (incluindo delivered/cancelled).
 */
export function useStatusCounts(): {
  counts: Record<string, number>;
  openTotal: number;
  total: number;
} {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const collection = database.get<ServiceOrder>('service_orders');
    const subscription = collection
      .query()
      .observeWithColumns(['status'])
      .subscribe((results) => {
        const map: Record<string, number> = {};
        for (const order of results) {
          map[order.status] = (map[order.status] ?? 0) + 1;
        }
        setCounts(map);
        setTotal(results.length);
      });

    return () => subscription.unsubscribe();
  }, []);

  const openTotal = Object.entries(counts)
    .filter(([status]) => status !== 'delivered' && status !== 'cancelled')
    .reduce((sum, [, count]) => sum + count, 0);

  return { counts, openTotal, total };
}
