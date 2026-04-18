/**
 * Paddock Solutions — dscar-web
 * Motor de Orçamentos (MO-5): Estoque Físico + NF-e Entrada
 *
 * Hooks TanStack Query v5 para UnidadeFisica, LoteInsumo, ImpressoraEtiqueta e NFeEntrada.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BaixaInsumoInput,
  BipagemInput,
  GerarEstoqueResult,
  ImpressoraEtiqueta,
  LoteInsumo,
  NFeEntrada,
  NFeEntradaCreateInput,
  NFeEntradaDetail,
  NFeEntradaItem,
  ReconciliarItemInput,
  ReservaInput,
  UnidadeFisica,
  UnidadeFisicaDetail,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const INV = "/api/proxy/inventory"
const FISCAL = "/api/proxy/fiscal"

// ─── fetchList helper (extrai .results do envelope DRF) ───────────────────────

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<{ results: T[] } | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const inventoryKeys = {
  all: ["inventory"] as const,
  unidades: (params = "") => ["inventory", "unidades", params] as const,
  unidade: (id: string) => ["inventory", "unidade", id] as const,
  lotes: (params = "") => ["inventory", "lotes", params] as const,
  impressoras: () => ["inventory", "impressoras"] as const,
}

export const nfeKeys = {
  all: ["nfe-entrada"] as const,
  list: (params = "") => ["nfe-entrada", "list", params] as const,
  detail: (id: string) => ["nfe-entrada", "detail", id] as const,
}

// ─── UnidadeFisica ────────────────────────────────────────────────────────────

export function useUnidades(params?: { peca?: string; status?: string }) {
  const qs = new URLSearchParams()
  if (params?.peca) qs.set("peca", params.peca)
  if (params?.status) qs.set("status", params.status)
  const q = qs.toString()
  return useQuery<UnidadeFisica[]>({
    queryKey: inventoryKeys.unidades(q),
    queryFn: () => fetchList<UnidadeFisica>(`${INV}/unidades/${q ? `?${q}` : ""}`),
  })
}

export function useUnidade(id: string) {
  return useQuery<UnidadeFisicaDetail>({
    queryKey: inventoryKeys.unidade(id),
    queryFn: () => apiFetch<UnidadeFisicaDetail>(`${INV}/unidades/${id}/`),
    enabled: !!id,
  })
}

export function useReservarUnidade(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ReservaInput) =>
      apiFetch<UnidadeFisica>(`${INV}/unidades/${id}/reservar/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })
}

export function useBipagem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BipagemInput) =>
      apiFetch<UnidadeFisica>(`${INV}/unidades/bipagem/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })
}

// ─── LoteInsumo ───────────────────────────────────────────────────────────────

export function useLotes(params?: { material?: string; saldo_gt?: "0" }) {
  const qs = new URLSearchParams()
  if (params?.material) qs.set("material", params.material)
  if (params?.saldo_gt) qs.set("saldo_gt", params.saldo_gt)
  const q = qs.toString()
  return useQuery<LoteInsumo[]>({
    queryKey: inventoryKeys.lotes(q),
    queryFn: () => fetchList<LoteInsumo>(`${INV}/lotes/${q ? `?${q}` : ""}`),
  })
}

export function useBaixarInsumo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BaixaInsumoInput) =>
      apiFetch<{ consumos_criados: number }>(`${INV}/baixar-insumo/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })
}

// ─── ImpressoraEtiqueta ───────────────────────────────────────────────────────

export function useImpressoras() {
  return useQuery<ImpressoraEtiqueta[]>({
    queryKey: inventoryKeys.impressoras(),
    queryFn: () => fetchList<ImpressoraEtiqueta>(`${INV}/impressoras/`),
  })
}

export function useImpressoraCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ImpressoraEtiqueta>) =>
      apiFetch<ImpressoraEtiqueta>(`${INV}/impressoras/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.impressoras() }),
  })
}

export function useImpressoraUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ImpressoraEtiqueta>) =>
      apiFetch<ImpressoraEtiqueta>(`${INV}/impressoras/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.impressoras() }),
  })
}

export function useImpressoraDelete(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`${INV}/impressoras/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.impressoras() }),
  })
}

export function useTestarImpressora(id: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ detail: string }>(`${INV}/impressoras/${id}/testar/`, { method: "POST" }),
  })
}

// ─── NF-e Entrada ─────────────────────────────────────────────────────────────

export function useNFeEntradas(params?: { status?: string; emitente?: string }) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set("status", params.status)
  if (params?.emitente) qs.set("emitente", params.emitente)
  const q = qs.toString()
  return useQuery<NFeEntrada[]>({
    queryKey: nfeKeys.list(q),
    queryFn: () => fetchList<NFeEntrada>(`${FISCAL}/nfe-entrada/${q ? `?${q}` : ""}`),
  })
}

export function useNFeEntrada(id: string) {
  return useQuery<NFeEntradaDetail>({
    queryKey: nfeKeys.detail(id),
    queryFn: () => apiFetch<NFeEntradaDetail>(`${FISCAL}/nfe-entrada/${id}/`),
    enabled: !!id,
  })
}

export function useNFeEntradaCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: NFeEntradaCreateInput) =>
      apiFetch<NFeEntrada>(`${FISCAL}/nfe-entrada/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: nfeKeys.all }),
  })
}

export function useReconciliarItem(nfeId: string, itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ReconciliarItemInput) =>
      apiFetch<NFeEntradaItem>(
        `${FISCAL}/nfe-entrada/${nfeId}/itens/${itemId}/reconciliar/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: nfeKeys.detail(nfeId) }),
  })
}

export function useGerarEstoque(nfeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<GerarEstoqueResult>(`${FISCAL}/nfe-entrada/${nfeId}/gerar-estoque/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: nfeKeys.all })
      qc.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })
}
