import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Q } from '@nozbe/watermelondb';
import type { Where } from '@nozbe/watermelondb/QueryDescription/type';

import { database } from '@/db/index';
import { ServiceOrder } from '@/db/models/ServiceOrder';
import { syncServiceOrders } from '@/db/sync';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useConnectivity } from './useConnectivity';
import type { ServiceOrderStatus } from '@paddock/types';

// ─── API Types ────────────────────────────────────────────────────────────────

// Re-export for consumers that import OSStatus from this module.
type OSStatus = ServiceOrderStatus;

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
        // Deduplicate by remoteId — prefer synced record over pending (temp).
        // Duplicates arise when an online-created record has a different
        // WatermelonDB id than what the sync pull later returns.
        const seen = new Map<string, ServiceOrder>();
        for (const order of results) {
          const existing = seen.get(order.remoteId);
          if (!existing) {
            seen.set(order.remoteId, order);
          } else if (order.pushStatus === 'synced' && existing.pushStatus !== 'synced') {
            seen.set(order.remoteId, order);
          }
        }
        setOrders([...seen.values()]);
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

  // Polling em foreground: sincroniza a cada 60 s enquanto o app está ativo.
  // Evita bateria desnecessária parando quando backgrounded.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isOnline) return;

    const start = (): void => {
      if (intervalRef.current !== null) return;
      intervalRef.current = setInterval(() => void doSync(), 60_000);
    };
    const stop = (): void => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    start();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') start();
      else stop();
    });

    return () => {
      stop();
      sub.remove();
    };
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapWdbToDetail(record: ServiceOrder): ServiceOrderDetailAPI {
  return {
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
}

// ─── useServiceOrder ──────────────────────────────────────────────────────────
//
// Estratégia híbrida:
// 1. WatermelonDB observer (sempre ativo) — fonte de verdade para status/totais
//    Reage instantaneamente quando o sync (polling 60s da lista) escreve dados.
// 2. TanStack Query — busca extras da API (checklist_items, photos_count, etc.)
//    Quando WDB detecta mudança em updatedAtRemote, invalida o cache para refetch.
//
// Online: merge WDB (real-time) + API (extras)
// Offline: apenas WDB

export function useServiceOrder(id: string): UseServiceOrderResult {
  const isOnline = useConnectivity();
  const queryClient = useQueryClient();

  // ── WatermelonDB observer — sempre ativo ─────────────────────────────────────
  const [wdbRecord, setWdbRecord] = useState<ServiceOrder | null>(null);
  const [isWdbLoading, setIsWdbLoading] = useState<boolean>(true);
  const prevUpdatedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!id) return;

    setIsWdbLoading(true);
    prevUpdatedAtRef.current = 0;

    const collection = database.get<ServiceOrder>('service_orders');
    const subscription = collection
      .query(Q.where('remote_id', id))
      .observe()
      .subscribe((results) => {
        const record = results[0] ?? null;
        setWdbRecord(record);
        setIsWdbLoading(false);

        // Quando online, invalida cache TanStack se o sync trouxe dados novos
        if (isOnline && record != null) {
          const updatedAt = record.updatedAtRemote;
          if (prevUpdatedAtRef.current !== 0 && updatedAt !== prevUpdatedAtRef.current) {
            void queryClient.invalidateQueries({ queryKey: serviceOrderKeys.detail(id) });
          }
          prevUpdatedAtRef.current = updatedAt;
        }
      });

    return () => subscription.unsubscribe();
  }, [id, isOnline, queryClient]);

  // ── Online: busca extras da API ───────────────────────────────────────────────
  const { data: apiOrder, isLoading: isApiLoading } = useQuery({
    queryKey: serviceOrderKeys.detail(id),
    queryFn: () => api.get<ServiceOrderDetailAPI>(`/service-orders/${id}/`),
    enabled: isOnline && id.length > 0,
    staleTime: 1000 * 60 * 2,
  });

  // ── Offline: apenas WDB ───────────────────────────────────────────────────────
  if (!isOnline) {
    return {
      order: wdbRecord != null ? mapWdbToDetail(wdbRecord) : null,
      isLoading: isWdbLoading,
      isOffline: true,
    };
  }

  // ── Online: merge API (extras) + WDB (status/totais em tempo real) ────────────
  let order: ServiceOrderDetailAPI | null = null;
  if (apiOrder != null) {
    order = wdbRecord != null
      ? {
          ...apiOrder,
          // Sobrescreve com campos WDB para refletir mudanças em tempo real
          status: wdbRecord.status as OSStatus,
          parts_total: String(wdbRecord.totalParts),
          services_total: String(wdbRecord.totalServices),
        }
      : apiOrder;
  } else if (wdbRecord != null) {
    // API ainda não respondeu — usa WDB como dados iniciais
    order = mapWdbToDetail(wdbRecord);
  }

  return {
    order,
    // Carregando apenas enquanto nenhuma fonte entregou dados
    isLoading: isApiLoading && isWdbLoading,
    isOffline: false,
  };
}
