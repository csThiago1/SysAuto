import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PaginatedResponse,
  ServiceOrder,
  ServiceOrderPart,
  ServiceOrderPartPayload,
  ServiceOrderLabor,
  ServiceOrderLaborPayload,
  AnyDashboardStats,
} from "@paddock/types";
import { apiFetch } from "@/lib/api";

const API = "/api/proxy";

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

export function useDashboardStats(role?: string): ReturnType<typeof useQuery<AnyDashboardStats>> {
  const param = role ? `?role=${role}` : ""
  return useQuery<AnyDashboardStats>({
    queryKey: ["dashboard-stats", role ?? "legacy"],
    queryFn: () =>
      apiFetch<AnyDashboardStats>(`${API}/service-orders/dashboard/stats/${param}`),
  })
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

export function useOSParts(osId: string) {
  return useQuery<ServiceOrderPart[]>({
    queryKey: ["service-order", osId, "parts"],
    queryFn: () => apiFetch<ServiceOrderPart[]>(`${API}/service-orders/${osId}/parts/`),
    enabled: Boolean(osId),
  });
}

export function useAddOSPart(osId: string) {
  const qc = useQueryClient();
  return useMutation<ServiceOrderPart, Error, ServiceOrderPartPayload>({
    mutationFn: (payload) =>
      apiFetch<ServiceOrderPart>(`${API}/service-orders/${osId}/parts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-order", osId, "parts"] });
      void qc.invalidateQueries({ queryKey: ["service-orders", osId] });
    },
  });
}

export function useUpdateOSPart(osId: string) {
  const qc = useQueryClient();
  return useMutation<ServiceOrderPart, Error, { partId: string } & Partial<ServiceOrderPartPayload>>({
    mutationFn: ({ partId, ...payload }) =>
      apiFetch<ServiceOrderPart>(`${API}/service-orders/${osId}/parts/${partId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-order", osId, "parts"] });
      void qc.invalidateQueries({ queryKey: ["service-orders", osId] });
    },
  });
}

export function useDeleteOSPart(osId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (partId) =>
      apiFetch<void>(`${API}/service-orders/${osId}/parts/${partId}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-order", osId, "parts"] });
      void qc.invalidateQueries({ queryKey: ["service-orders", osId] });
    },
  });
}

export function useOSLabor(osId: string) {
  return useQuery<ServiceOrderLabor[]>({
    queryKey: ["service-order", osId, "labor"],
    queryFn: () => apiFetch<ServiceOrderLabor[]>(`${API}/service-orders/${osId}/labor/`),
    enabled: Boolean(osId),
  });
}

export function useAddOSLabor(osId: string) {
  const qc = useQueryClient();
  return useMutation<ServiceOrderLabor, Error, ServiceOrderLaborPayload>({
    mutationFn: (payload) =>
      apiFetch<ServiceOrderLabor>(`${API}/service-orders/${osId}/labor/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-order", osId, "labor"] });
      void qc.invalidateQueries({ queryKey: ["service-orders", osId] });
    },
  });
}

export function useUpdateOSLabor(osId: string) {
  const qc = useQueryClient();
  return useMutation<ServiceOrderLabor, Error, { laborId: string } & Partial<ServiceOrderLaborPayload>>({
    mutationFn: ({ laborId, ...payload }) =>
      apiFetch<ServiceOrderLabor>(`${API}/service-orders/${osId}/labor/${laborId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-order", osId, "labor"] });
      void qc.invalidateQueries({ queryKey: ["service-orders", osId] });
    },
  });
}

export function useDeleteOSLabor(osId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (laborId) =>
      apiFetch<void>(`${API}/service-orders/${osId}/labor/${laborId}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-order", osId, "labor"] });
      void qc.invalidateQueries({ queryKey: ["service-orders", osId] });
    },
  });
}
