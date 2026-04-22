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
  filters: Record<string, string> = {},
  page: number = 1,
  pageSize: number = 20
): ReturnType<typeof useQuery<PaginatedResponse<ServiceOrder>>> {
  const params = new URLSearchParams({ ...filters, page: String(page), page_size: String(pageSize) }).toString();
  return useQuery<PaginatedResponse<ServiceOrder>>({
    queryKey: ["service-orders", filters, page, pageSize],
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

// ─── Vehicle History ──────────────────────────────────────────────────────────

export interface VehicleHistory {
  found: boolean
  plate?: string
  make?: string
  model?: string
  year?: number | null
  vehicle_version?: string
  color?: string
  fuel_type?: string
  fipe_value?: string | null
  last_customer_name?: string
  last_customer_uuid?: string | null
  visits?: number
  last_visit?: string | null
}

export interface PlateApiResult {
  plate: string
  make: string
  model: string
  year: number | null
  chassis: string
  renavam: string
  city: string
}

/** Busca veículo no histórico de OS por placa (backend). */
export function useVehicleHistory(plate: string) {
  const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return useQuery<VehicleHistory>({
    queryKey: ["vehicle-history", normalized],
    queryFn: () =>
      apiFetch<VehicleHistory>(
        `${API}/service-orders/vehicle-history/?plate=${normalized}`
      ),
    enabled: normalized.length >= 7,
    staleTime: 60 * 1000,
  })
}

/** Consulta placa na API externa (placa-fipe via proxy Next.js). Apenas chamado manualmente. */
export function usePlateApi() {
  return useMutation<PlateApiResult, Error, string>({
    mutationFn: (plate: string) => {
      const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "")
      return apiFetch<PlateApiResult>(`/api/plate/${normalized}`)
    },
  })
}
