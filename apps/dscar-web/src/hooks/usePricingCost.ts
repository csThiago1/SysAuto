/**
 * Paddock Solutions — Motor de Orçamentos (MO-3: Adapters de Custo)
 * Hooks TanStack Query v5 para parâmetros de custo/hora, rateio e debug.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CustoHoraFallback,
  CustoHoraFallbackCreate,
  CustoHoraResult,
  DebugCustoHoraInput,
  DebugRateioInput,
  ParametroCustoHora,
  ParametroCustoHoraCreate,
  ParametroRateio,
  ParametroRateioCreate,
  PaginatedResponse,
  RateioResult,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const ENGINE_API = "/api/proxy/pricing/engine"

// ─── Query Keys ───────────────────────────────────────────────────────────────

const pricingCostKeys = {
  all: ["pricing-cost"] as const,
  parametrosRateio: (empresaId?: string) =>
    ["pricing-cost", "parametros-rateio", empresaId ?? "all"] as const,
  parametrosCustoHora: (empresaId?: string) =>
    ["pricing-cost", "parametros-custo-hora", empresaId ?? "all"] as const,
  custosHoraFallback: (empresaId?: string) =>
    ["pricing-cost", "custos-hora-fallback", empresaId ?? "all"] as const,
}

// ─── Parâmetros de Rateio ─────────────────────────────────────────────────────

export function useParametrosRateio(empresaId?: string) {
  const params = empresaId
    ? `?empresa=${encodeURIComponent(empresaId)}`
    : ""
  return useQuery<PaginatedResponse<ParametroRateio>>({
    queryKey: pricingCostKeys.parametrosRateio(empresaId),
    queryFn: () =>
      apiFetch<PaginatedResponse<ParametroRateio>>(
        `${ENGINE_API}/parametros/rateio/${params}`
      ),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateParametroRateio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ParametroRateioCreate) =>
      apiFetch<ParametroRateio>(`${ENGINE_API}/parametros/rateio/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingCostKeys.all }),
  })
}

export function useUpdateParametroRateio(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ParametroRateioCreate>) =>
      apiFetch<ParametroRateio>(`${ENGINE_API}/parametros/rateio/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingCostKeys.all }),
  })
}

// ─── Parâmetros de Custo Hora ─────────────────────────────────────────────────

export function useParametrosCustoHora(empresaId?: string) {
  const params = empresaId
    ? `?empresa=${encodeURIComponent(empresaId)}`
    : ""
  return useQuery<PaginatedResponse<ParametroCustoHora>>({
    queryKey: pricingCostKeys.parametrosCustoHora(empresaId),
    queryFn: () =>
      apiFetch<PaginatedResponse<ParametroCustoHora>>(
        `${ENGINE_API}/parametros/custo-hora/${params}`
      ),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateParametroCustoHora() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ParametroCustoHoraCreate) =>
      apiFetch<ParametroCustoHora>(`${ENGINE_API}/parametros/custo-hora/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingCostKeys.all }),
  })
}

export function useUpdateParametroCustoHora(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ParametroCustoHoraCreate>) =>
      apiFetch<ParametroCustoHora>(
        `${ENGINE_API}/parametros/custo-hora/${id}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingCostKeys.all }),
  })
}

// ─── Custos Hora Fallback ─────────────────────────────────────────────────────

export function useCustosHoraFallback(empresaId?: string) {
  const params = empresaId
    ? `?empresa=${encodeURIComponent(empresaId)}`
    : ""
  return useQuery<PaginatedResponse<CustoHoraFallback>>({
    queryKey: pricingCostKeys.custosHoraFallback(empresaId),
    queryFn: () =>
      apiFetch<PaginatedResponse<CustoHoraFallback>>(
        `${ENGINE_API}/parametros/custo-hora-fallback/${params}`
      ),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCustoHoraFallback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CustoHoraFallbackCreate) =>
      apiFetch<CustoHoraFallback>(
        `${ENGINE_API}/parametros/custo-hora-fallback/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingCostKeys.all }),
  })
}

export function useUpdateCustoHoraFallback(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CustoHoraFallbackCreate>) =>
      apiFetch<CustoHoraFallback>(
        `${ENGINE_API}/parametros/custo-hora-fallback/${id}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingCostKeys.all }),
  })
}

export function useDeleteCustoHoraFallback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${ENGINE_API}/parametros/custo-hora-fallback/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingCostKeys.all }),
  })
}

// ─── Debug Mutations ──────────────────────────────────────────────────────────

/**
 * Mutation para calcular custo/hora via endpoint de debug.
 * Apenas ADMIN+ pode usar — retorna CustoHoraResult com decomposição.
 */
export function useDebugCustoHora() {
  return useMutation({
    mutationFn: (input: DebugCustoHoraInput) =>
      apiFetch<CustoHoraResult>(`${ENGINE_API}/debug/custo-hora/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
  })
}

/**
 * Mutation para calcular rateio/hora via endpoint de debug.
 * Apenas ADMIN+ pode usar — retorna RateioResult com decomposição de despesas.
 */
export function useDebugRateio() {
  return useMutation({
    mutationFn: (input: DebugRateioInput) =>
      apiFetch<RateioResult>(`${ENGINE_API}/debug/rateio/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
  })
}
