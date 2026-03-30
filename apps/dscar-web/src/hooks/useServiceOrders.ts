import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaginatedResponse, ServiceOrder } from "@paddock/types";

const API = "/api/proxy";

async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function useServiceOrders(
  filters: Record<string, string> = {}
): ReturnType<typeof useQuery<PaginatedResponse<ServiceOrder>>> {
  const params = new URLSearchParams(filters).toString();
  return useQuery<PaginatedResponse<ServiceOrder>>({
    queryKey: ["service-orders", filters],
    queryFn: () => apiFetch<PaginatedResponse<ServiceOrder>>(`${API}/service-orders/?${params}`),
  });
}

export function useServiceOrder(
  id: string
): ReturnType<typeof useQuery<ServiceOrder>> {
  return useQuery<ServiceOrder>({
    queryKey: ["service-orders", id],
    queryFn: () => apiFetch<ServiceOrder>(`${API}/service-orders/${id}/`),
  });
}

interface DashboardStats {
  total_open: number;
  by_status: Record<string, number>;
  today_deliveries: number;
}

export function useDashboardStats(): ReturnType<typeof useQuery<DashboardStats>> {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiFetch<DashboardStats>(`${API}/service-orders/dashboard/stats/`),
  });
}

export function useTransitionStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) =>
      apiFetch(`${API}/service-orders/${id}/transition/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_status: status }),  // campo correto do serializer
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-orders", id] });
      void qc.invalidateQueries({ queryKey: ["service-orders"] });
    },
  });
}
