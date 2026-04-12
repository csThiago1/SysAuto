import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import type { Where } from '@nozbe/watermelondb/QueryDescription/type';

import { database } from '@/db/index';
import { ServiceOrder } from '@/db/models/ServiceOrder';
import { syncServiceOrders } from '@/db/sync';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useConnectivity } from './useConnectivity';

// ─── API Types ────────────────────────────────────────────────────────────────

type OSStatus =
  | 'reception'
  | 'initial_survey'
  | 'budget'
  | 'waiting_approval'
  | 'waiting_auth'
  | 'authorized'
  | 'approved'
  | 'in_progress'
  | 'waiting_parts'
  | 'repair'
  | 'mechanic'
  | 'bodywork'
  | 'painting'
  | 'assembly'
  | 'polishing'
  | 'washing'
  | 'final_survey'
  | 'ready'
  | 'delivered'
  | 'cancelled';

interface ServiceOrderAPI {
  id: string;
  number: number;
  status: OSStatus;
  customer_name: string;
  plate: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  customer_type: string;
  os_type: string;
  parts_total: string; // DRF retorna Decimal como string
  services_total: string;
  opened_at: string;
  updated_at: string;
  consultant?: { id: string; email: string; full_name: string };
}

interface ServiceOrderDetailAPI extends ServiceOrderAPI {
  checklist_items?: {
    id: string;
    label: string;
    checked: boolean;
    notes: string | null;
  }[];
  photos_count?: number;
  vehicle_vin?: string | null;
  notes?: string | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface OSFilters {
  status?: OSStatus;
  search?: string;
  page?: number;
}

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface UseServiceOrdersListResult {
  orders: ServiceOrder[];
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  refetch: () => void;
  fetchNextPage: () => void;
  isOffline: boolean;
}

export interface UseServiceOrderResult {
  order: ServiceOrderDetailAPI | null;
  isLoading: boolean;
  isOffline: boolean;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const serviceOrderKeys = {
  all: ['service-orders'] as const,
  lists: () => [...serviceOrderKeys.all, 'list'] as const,
  list: (filters: OSFilters) => [...serviceOrderKeys.lists(), filters] as const,
  details: () => [...serviceOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...serviceOrderKeys.details(), id] as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────


// ─── useServiceOrdersList ─────────────────────────────────────────────────────
//
// WatermelonDB é a fonte de verdade única (online e offline).
// Quando online, aciona sync no mount e no pull-to-refresh.
// O observer WatermelonDB reage automaticamente quando o sync escreve registros.

export function useServiceOrdersList(filters: OSFilters): UseServiceOrdersListResult {
  const isOnline = useConnectivity();
  const logout = useAuthStore((s) => s.logout);

  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Observa WatermelonDB — dispara sempre que o sync escreve registros
  useEffect(() => {
    const collection = database.get<ServiceOrder>('service_orders');
    const conditions: Where[] = [];

    if (filters.status) {
      conditions.push(Q.where('status', filters.status));
    }
    if (filters.search) {
      const term = filters.search;
      const sanitized = Q.sanitizeLikeString(term);
      const numericTerm = Number(term);
      const isNumeric = !isNaN(numericTerm) && term.trim() !== '';
      conditions.push(
        Q.or(
          Q.where('vehicle_plate', Q.like(`%${sanitized}%`)),
          Q.where('customer_name', Q.like(`%${sanitized}%`)),
          Q.where('vehicle_model', Q.like(`%${sanitized}%`)),
          Q.where('vehicle_brand', Q.like(`%${sanitized}%`)),
          ...(isNumeric ? [Q.where('number', numericTerm)] : []),
        ),
      );
    }

    const subscription = collection
      .query(...conditions)
      .observe()
      .subscribe((results) => {
        setOrders(results);
        setIsInitialLoad(false);
      });

    return () => subscription.unsubscribe();
  }, [filters.status, filters.search]);

  // Executa sync quando online — result popula WatermelonDB, observer reage
  const doSync = useCallback(async (): Promise<void> => {
    try {
      await syncServiceOrders();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('401')) {
        logout();
      } else {
        console.warn('Sync failed:', error);
      }
    }
  }, [logout]);

  useEffect(() => {
    if (!isOnline) return;
    void doSync();
  }, [isOnline, doSync]);

  const refetch = useCallback((): void => {
    if (!isOnline) return;
    setIsRefreshing(true);
    void doSync().finally(() => setIsRefreshing(false));
  }, [isOnline, doSync]);

  return {
    orders,
    isLoading: isInitialLoad,
    isRefreshing,
    isFetchingNextPage: false,
    hasNextPage: false,
    refetch,
    fetchNextPage: () => undefined,
    isOffline: !isOnline,
  };
}

// ─── useServiceOrder ──────────────────────────────────────────────────────────

export function useServiceOrder(id: string): UseServiceOrderResult {
  const isOnline = useConnectivity();

  // ── Online: fetch from API ───────────────────────────────────────────────────
  const { data: apiOrder, isLoading: isApiLoading } = useQuery({
    queryKey: serviceOrderKeys.detail(id),
    queryFn: () => api.get<ServiceOrderDetailAPI>(`/service-orders/${id}/`),
    enabled: isOnline && id.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  // ── Offline: observe WatermelonDB by remoteId ────────────────────────────────
  const [localOrder, setLocalOrder] = useState<ServiceOrderDetailAPI | null>(null);
  const [isLocalLoading, setIsLocalLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOnline || !id) return;

    let cancelled = false;
    setIsLocalLoading(true);

    const collection = database.get<ServiceOrder>('service_orders');
    const query = collection.query(Q.where('remote_id', id)).observe();

    const subscription = query.subscribe((results) => {
      if (!cancelled) {
        const record = results[0];
        if (record) {
          // Map WatermelonDB model fields back to the API shape.
          const mapped: ServiceOrderDetailAPI = {
            id: record.remoteId,
            number: record.number,
            status: record.status as OSStatus,
            customer_name: record.customerName,
            plate: record.vehiclePlate,
            make: record.vehicleBrand,
            model: record.vehicleModel,
            year: record.vehicleYear ?? undefined,
            color: record.vehicleColor ?? undefined,
            customer_type: record.customerType,
            os_type: record.osType,
            parts_total: String(record.totalParts),
            services_total: String(record.totalServices),
            opened_at: new Date(record.createdAtRemote).toISOString(),
            updated_at: new Date(record.updatedAtRemote).toISOString(),
            consultant: record.consultantName
              ? { id: '', email: '', full_name: record.consultantName }
              : undefined,
          };
          setLocalOrder(mapped);
        } else {
          setLocalOrder(null);
        }
        setIsLocalLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isOnline, id]);

  if (!isOnline) {
    return {
      order: localOrder,
      isLoading: isLocalLoading,
      isOffline: true,
    };
  }

  return {
    order: apiOrder ?? null,
    isLoading: isApiLoading,
    isOffline: false,
  };
}
