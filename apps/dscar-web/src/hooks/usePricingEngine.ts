/**
 * Paddock Solutions — Motor de Orçamentos (MO-6: Motor de Precificação)
 * Hooks TanStack Query v5 para motor de preços, margens, markup e snapshots.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CalcularPecaInput,
  CalcularServicoInput,
  MargemOperacao,
  MargemOperacaoCreate,
  MarkupPeca,
  MarkupPecaCreate,
  PaginatedResponse,
  ResultadoPecaDTO,
  ResultadoServicoDTO,
  SimularInput,
  SimularResponse,
  Snapshot,
  SnapshotFull,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const ENGINE_API = "/api/proxy/pricing/engine"

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<PaginatedResponse<T> | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

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

export function useMargemCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MargemOperacaoCreate) =>
      apiFetch<MargemOperacao>(`${ENGINE_API}/margens/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-engine", "margens"] })
    },
  })
}

export function useMargemDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${ENGINE_API}/margens/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-engine", "margens"] })
    },
  })
}

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

export function useMarkupPecaCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MarkupPecaCreate) =>
      apiFetch<MarkupPeca>(`${ENGINE_API}/markup-peca/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-engine", "markups-peca"] })
    },
  })
}

export function useMarkupPecaDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${ENGINE_API}/markup-peca/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-engine", "markups-peca"] })
    },
  })
}

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

// ─── Cálculo (mutations) ─────────────────────────────────────────────────────

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
