import { useState, useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import type { Where } from '@nozbe/watermelondb/QueryDescription/type';

import { database } from '@/db/index';
import { ServiceOrder } from '@/db/models/ServiceOrder';
import { syncServiceOrders } from '@/db/sync';
import { api } from '@/lib/api';
import { useConnectivity } from './useConnectivity';

// ─── API Types ────────────────────────────────────────────────────────────────

type OSStatus =
  | 'reception'
  | 'initial_survey'
  | 'budget'
  | 'waiting_approval'
  | 'approved'
  | 'in_progress'
  | 'waiting_parts'
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

function buildQueryString(filters: OSFilters, page: number): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.status) {
    params.set('status', filters.status);
  }
  return params.toString();
}

/**
 * Best-effort sync to keep local WatermelonDB cache warm after an API fetch.
 * Failures are intentionally swallowed — the UI is already rendering fresh API data.
 */
async function syncAfterFetch(): Promise<void> {
  try {
    await syncServiceOrders();
  } catch {
    // Non-fatal: local cache may be slightly stale until next foreground sync.
  }
}

// ─── useServiceOrdersList ─────────────────────────────────────────────────────

export function useServiceOrdersList(filters: OSFilters): UseServiceOrdersListResult {
  const isOnline = useConnectivity();

  // ── Offline path: observe WatermelonDB collection ───────────────────────────
  const [offlineOrders, setOfflineOrders] = useState<ServiceOrder[]>([]);
  const [isOfflineLoading, setIsOfflineLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOnline) return;

    let cancelled = false;
    setIsOfflineLoading(true);

    const collection = database.get<ServiceOrder>('service_orders');
    const conditions: Where[] = [];

    if (filters.status) {
      conditions.push(Q.where('status', filters.status));
    }

    if (filters.search) {
      const term = filters.search;
      const numericTerm = Number(term);

      if (!isNaN(numericTerm) && term.trim() !== '') {
        // Search by OS number (exact match).
        conditions.push(
          Q.or(
            Q.where('vehicle_plate', Q.like(`%${Q.sanitizeLikeString(term)}%`)),
            Q.where('number', numericTerm),
          ),
        );
      } else {
        // Search by plate substring only when input is not numeric.
        conditions.push(Q.where('vehicle_plate', Q.like(`%${Q.sanitizeLikeString(term)}%`)));
      }
    }

    const query = collection.query(...conditions).observe();
    const subscription = query.subscribe((results) => {
      if (!cancelled) {
        setOfflineOrders(results);
        setIsOfflineLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isOnline, filters.status, filters.search]);

  // ── Online path: TanStack Query with infinite pagination ─────────────────────
  const {
    data,
    isLoading: isOnlineLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    refetch,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: serviceOrderKeys.list(filters),
    queryFn: async ({ pageParam }) => {
      const qs = buildQueryString(filters, pageParam as number);
      const result = await api.get<PaginatedResponse<ServiceOrderAPI>>(
        `/service-orders/?${qs}`,
      );
      // Fire-and-forget — keep WatermelonDB cache warm for offline use.
      void syncAfterFetch();
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.next === null) return undefined;
      return (lastPageParam as number) + 1;
    },
    enabled: isOnline,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // ── Map API page results to WatermelonDB models for a consistent return type ─
  // WatermelonDB models are observed reactively. After syncAfterFetch() writes the
  // records, these observers pick up the current state from the local DB.
  const [onlineOrders, setOnlineOrders] = useState<ServiceOrder[]>([]);

  useEffect(() => {
    if (!isOnline || !data) return;

    const apiIds = data.pages.flatMap((p) => p.results.map((r) => r.id));
    if (apiIds.length === 0) {
      setOnlineOrders([]);
      return;
    }

    let cancelled = false;
    const collection = database.get<ServiceOrder>('service_orders');

    const query = collection.query(Q.where('remote_id', Q.oneOf(apiIds))).observe();
    const subscription = query.subscribe((results) => {
      if (!cancelled) {
        // Preserve API page order.
        const byRemoteId = new Map(results.map((o) => [o.remoteId, o]));
        const ordered = apiIds.flatMap((id) => {
          const model = byRemoteId.get(id);
          return model ? [model] : [];
        });
        setOnlineOrders(ordered);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [isOnline, data]);

  if (!isOnline) {
    return {
      orders: offlineOrders,
      isLoading: isOfflineLoading,
      isRefreshing: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      refetch: () => undefined,
      fetchNextPage: () => undefined,
      isOffline: true,
    };
  }

  return {
    orders: onlineOrders,
    isLoading: isOnlineLoading,
    isRefreshing: isFetching && !isFetchingNextPage,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    refetch: () => void refetch(),
    fetchNextPage: () => void fetchNextPage(),
    isOffline: false,
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
