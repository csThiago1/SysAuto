/**
 * Paddock Solutions — dscar-web
 * Hooks TanStack Query v5 para o modulo de Compras (Purchasing).
 *
 * PedidoCompra, OrdemCompra, ItemOrdemCompra, DashboardComprasStats.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdicionarItemOCInput,
  DashboardComprasStats,
  ItemOrdemCompra,
  OrdemCompra,
  OrdemCompraDetail,
  PedidoCompra,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const PURCHASING = "/api/proxy/purchasing"

// ─── fetchList helper (extrai .results do envelope DRF) ───────────────────────

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<{ results: T[] } | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const purchasingKeys = {
  all: ["purchasing"] as const,
  pedidos: (params?: Record<string, string>) => [...purchasingKeys.all, "pedidos", params] as const,
  ordensCompra: () => [...purchasingKeys.all, "ordens-compra"] as const,
  ordemCompra: (id: string) => [...purchasingKeys.all, "ordem-compra", id] as const,
  dashboard: () => [...purchasingKeys.all, "dashboard"] as const,
}

// ─── Pedidos de Compra ────────────────────────────────────────────────────────

export function usePedidosCompra(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : ""
  return useQuery<PedidoCompra[]>({
    queryKey: purchasingKeys.pedidos(params),
    queryFn: () => fetchList<PedidoCompra>(`${PURCHASING}/pedidos/${qs ? `?${qs}` : ""}`),
  })
}

export function useIniciarCotacao(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<PedidoCompra>(`${PURCHASING}/pedidos/${id}/iniciar-cotacao/`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useCancelarPedido(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<PedidoCompra>(`${PURCHASING}/pedidos/${id}/cancelar/`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

// ─── Ordens de Compra ─────────────────────────────────────────────────────────

export function useOrdensCompra() {
  return useQuery<OrdemCompra[]>({
    queryKey: purchasingKeys.ordensCompra(),
    queryFn: () => fetchList<OrdemCompra>(`${PURCHASING}/ordens-compra/`),
  })
}

export function useOrdemCompra(id: string) {
  return useQuery<OrdemCompraDetail>({
    queryKey: purchasingKeys.ordemCompra(id),
    queryFn: () => apiFetch<OrdemCompraDetail>(`${PURCHASING}/ordens-compra/${id}/`),
    enabled: !!id,
  })
}

export function useCriarOC() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { service_order: string }) =>
      apiFetch<OrdemCompra>(`${PURCHASING}/ordens-compra/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.ordensCompra() })
    },
  })
}

export function useAdicionarItemOC(ocId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AdicionarItemOCInput) =>
      apiFetch<ItemOrdemCompra>(`${PURCHASING}/ordens-compra/${ocId}/itens/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.ordemCompra(ocId) })
    },
  })
}

export function useRemoverItemOC(ocId: string, itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`${PURCHASING}/ordens-compra/${ocId}/itens/${itemId}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.ordemCompra(ocId) })
    },
  })
}

export function useEnviarOC(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<OrdemCompra>(`${PURCHASING}/ordens-compra/${id}/enviar/`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useAprovarOC(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<OrdemCompra>(`${PURCHASING}/ordens-compra/${id}/aprovar/`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useRejeitarOC(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { motivo: string }) =>
      apiFetch<OrdemCompra>(`${PURCHASING}/ordens-compra/${id}/rejeitar/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.all })
    },
  })
}

export function useRegistrarRecebimento(ocId: string, itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<ItemOrdemCompra>(
        `${PURCHASING}/ordens-compra/${ocId}/itens/${itemId}/receber/`,
        { method: "POST" }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: purchasingKeys.ordemCompra(ocId) })
      void qc.invalidateQueries({ queryKey: purchasingKeys.pedidos() })
    },
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useDashboardCompras() {
  return useQuery<DashboardComprasStats>({
    queryKey: purchasingKeys.dashboard(),
    queryFn: () => apiFetch<DashboardComprasStats>(`${PURCHASING}/dashboard-stats/`),
  })
}
