/**
 * Paddock Solutions — Motor de Orçamentos (MO-6: Motor de Precificação)
 * Hooks TanStack Query v5 para motor de preços, margens, markup e snapshots.
 */
import { useMutation, useQuery } from "@tanstack/react-query"
import type {
  CalcularPecaInput,
  CalcularServicoInput,
  MargemOperacaoCreate,
  MarkupPecaCreate,
  ResultadoPecaDTO,
  ResultadoServicoDTO,
  SimularInput,
  SimularResponse,
  Snapshot,
  SnapshotFull,
} from "@paddock/types"

import { apiFetch, fetchList } from "@/lib/api"
import { useCreate, useDelete } from "@/lib/crud-mutations"
import type { ApiSchema } from "@/types"

// Gerados dos serializers Django (match 1:1 verificado).
export type MargemOperacao = ApiSchema<"MargemOperacao">
export type MarkupPeca = ApiSchema<"MarkupPeca">

const ENGINE_API = "/api/proxy/pricing/engine"

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const pricingEngineKeys = {
  all: ["pricing-engine"] as const,
  margens: (empresaId?: string) =>
    ["pricing-engine", "margens", empresaId ?? "all"] as const,
  markupsPeca: (empresaId?: string) =>
    ["pricing-engine", "markups-peca", empresaId ?? "all"] as const,
  snapshots: (filters?: Record<string, string>) =>
    ["pricing-engine", "snapshots", filters ?? {}] as const,
  snapshot: (id: string) => ["pricing-engine", "snapshots", id] as const,
}

// ─── Margens de Operação ──────────────────────────────────────────────────────

export function useMargens(empresaId?: string) {
  const params = empresaId
    ? `?empresa=${encodeURIComponent(empresaId)}`
    : ""
  return useQuery({
    queryKey: pricingEngineKeys.margens(empresaId),
    queryFn: () => fetchList<MargemOperacao>(`${ENGINE_API}/margens/${params}`),
  })
}

const MARGENS_OPTS = { invalidateKey: ["pricing-engine", "margens"] }
export const useMargemCreate = () =>
  useCreate<MargemOperacao, MargemOperacaoCreate>(
    "pricing/engine/margens",
    MARGENS_OPTS,
  )
export const useMargemDelete = () =>
  useDelete("pricing/engine/margens", MARGENS_OPTS)

// ─── Markup por Peça ─────────────────────────────────────────────────────────

export function useMarkupsPeca(empresaId?: string) {
  const params = empresaId
    ? `?empresa=${encodeURIComponent(empresaId)}`
    : ""
  return useQuery({
    queryKey: pricingEngineKeys.markupsPeca(empresaId),
    queryFn: () => fetchList<MarkupPeca>(`${ENGINE_API}/markup-peca/${params}`),
  })
}

const MARKUP_OPTS = { invalidateKey: ["pricing-engine", "markups-peca"] }
export const useMarkupPecaCreate = () =>
  useCreate<MarkupPeca, MarkupPecaCreate>(
    "pricing/engine/markup-peca",
    MARKUP_OPTS,
  )
export const useMarkupPecaDelete = () =>
  useDelete("pricing/engine/markup-peca", MARKUP_OPTS)

// ─── Snapshots ───────────────────────────────────────────────────────────────

export function useSnapshots(filters?: Record<string, string>) {
  const params = filters
    ? `?${new URLSearchParams(filters).toString()}`
    : ""
  return useQuery({
    queryKey: pricingEngineKeys.snapshots(filters),
    queryFn: () => fetchList<Snapshot>(`${ENGINE_API}/snapshots/${params}`),
    staleTime: Infinity, // snapshots são imutáveis
  })
}

export function useSnapshot(id: string) {
  return useQuery({
    queryKey: pricingEngineKeys.snapshot(id),
    queryFn: () => apiFetch<SnapshotFull>(`${ENGINE_API}/snapshots/${id}/`),
    staleTime: Infinity,
    enabled: !!id,
  })
}

// ─── Cálculo (mutations sem invalidação — efeito puro) ───────────────────────

export function useCalcularServico() {
  return useMutation({
    mutationFn: (payload: CalcularServicoInput) =>
      apiFetch<ResultadoServicoDTO>(`${ENGINE_API}/calcular-servico/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  })
}

export function useCalcularPeca() {
  return useMutation({
    mutationFn: (payload: CalcularPecaInput) =>
      apiFetch<ResultadoPecaDTO>(`${ENGINE_API}/calcular-peca/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  })
}

export function useSimular() {
  return useMutation({
    mutationFn: (payload: SimularInput) =>
      apiFetch<SimularResponse>(`${ENGINE_API}/simular/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  })
}
