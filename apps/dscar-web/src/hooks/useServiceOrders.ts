import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  PaginatedResponse,
  PlateApiResult,
  ServiceOrder,
  AnyDashboardStats,
  PecaEstoqueResult,
  VehicleHistory,
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

// ─── Buscar Pecas no Estoque ─────────────────────────────────────────────────

export function useBuscarPecas(params?: Record<string, string>) {
  const search = params ? "?" + new URLSearchParams(params).toString() : ""
  return useQuery<PecaEstoqueResult[]>({
    queryKey: ["inventory", "buscar-pecas", params],
    queryFn: () => apiFetch<PecaEstoqueResult[]>(`/api/proxy/inventory/buscar-pecas/${search}`),
    enabled: !!params?.busca && params.busca.length >= 2,
  })
}

// ─── Vehicle History ──────────────────────────────────────────────────────────

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
