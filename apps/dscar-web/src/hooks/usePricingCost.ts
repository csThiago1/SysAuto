/**
 * Paddock Solutions — Motor de Orçamentos (MO-3: Adapters de Custo)
 * Hooks TanStack Query v5 para parâmetros de custo/hora, rateio e debug.
 */
import { useMutation, useQuery } from "@tanstack/react-query"
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
import { useCreate, useDelete, useUpdate } from "@/lib/crud-mutations"

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

const COST_OPTS = { invalidateKey: pricingCostKeys.all }

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

export const useCreateParametroRateio = () =>
  useCreate<ParametroRateio, ParametroRateioCreate>(
    "pricing/engine/parametros/rateio",
    COST_OPTS,
  )
export const useUpdateParametroRateio = () =>
  useUpdate<ParametroRateio, Partial<ParametroRateioCreate>>(
    "pricing/engine/parametros/rateio",
    COST_OPTS,
  )

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

export const useCreateParametroCustoHora = () =>
  useCreate<ParametroCustoHora, ParametroCustoHoraCreate>(
    "pricing/engine/parametros/custo-hora",
    COST_OPTS,
  )
export const useUpdateParametroCustoHora = () =>
  useUpdate<ParametroCustoHora, Partial<ParametroCustoHoraCreate>>(
    "pricing/engine/parametros/custo-hora",
    COST_OPTS,
  )

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

export const useCreateCustoHoraFallback = () =>
  useCreate<CustoHoraFallback, CustoHoraFallbackCreate>(
    "pricing/engine/parametros/custo-hora-fallback",
    COST_OPTS,
  )
export const useUpdateCustoHoraFallback = () =>
  useUpdate<CustoHoraFallback, Partial<CustoHoraFallbackCreate>>(
    "pricing/engine/parametros/custo-hora-fallback",
    COST_OPTS,
  )
export const useDeleteCustoHoraFallback = () =>
  useDelete("pricing/engine/parametros/custo-hora-fallback", COST_OPTS)

// ─── Debug Mutations ──────────────────────────────────────────────────────────
// Não invalidam cache (cálculo on-demand, sem efeito colateral).

/** Mutation para calcular custo/hora via endpoint de debug. ADMIN+. */
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

/** Mutation para calcular rateio/hora via endpoint de debug. ADMIN+. */
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
