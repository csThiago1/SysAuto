/**
 * Paddock Solutions — dscar-web
 * WMS: Hooks TanStack Query v5 para Movimentacao de Estoque
 * Entrada, Devolucao, Transferencia, Perda, Aprovacoes
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  EntradaLoteInput,
  EntradaPecaInput,
  MovimentacaoEstoque,
  PerdaInput,
  TransferenciaInput,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const INV = "/api/proxy/inventory"

// ─── fetchList helper (extrai .results do envelope DRF) ───────────────────────

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<{ results: T[] } | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const movementKeys = {
  all: ["inventory-movement"] as const,
  movimentacoes: (params?: Record<string, string>) =>
    [...movementKeys.all, "movimentacoes", params] as const,
  movimentacao: (id: string) =>
    [...movementKeys.all, "movimentacao", id] as const,
  aprovacoesPendentes: () =>
    [...movementKeys.all, "aprovacoes-pendentes"] as const,
}

// ─── Movimentacoes ────────────────────────────────────────────────────────────

export function useMovimentacoes(params?: Record<string, string>) {
  const qs = new URLSearchParams(params ?? {}).toString()
  return useQuery<MovimentacaoEstoque[]>({
    queryKey: movementKeys.movimentacoes(params),
    queryFn: () =>
      fetchList<MovimentacaoEstoque>(
        `${INV}/movimentacoes/${qs ? `?${qs}` : ""}`
      ),
  })
}

export function useMovimentacao(id: string) {
  return useQuery<MovimentacaoEstoque>({
    queryKey: movementKeys.movimentacao(id),
    queryFn: () =>
      apiFetch<MovimentacaoEstoque>(`${INV}/movimentacoes/${id}/`),
    enabled: !!id,
  })
}

// ─── Entrada ──────────────────────────────────────────────────────────────────

export function useEntradaPeca() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EntradaPecaInput) =>
      apiFetch<MovimentacaoEstoque>(`${INV}/entrada/peca/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movementKeys.all })
    },
  })
}

export function useEntradaLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EntradaLoteInput) =>
      apiFetch<MovimentacaoEstoque>(`${INV}/entrada/lote/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movementKeys.all })
    },
  })
}

// ─── Devolucao ────────────────────────────────────────────────────────────────

export function useDevolucao(unidadeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<MovimentacaoEstoque>(`${INV}/devolucao/${unidadeId}/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movementKeys.all })
    },
  })
}

// ─── Transferencia ────────────────────────────────────────────────────────────

export function useTransferir() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TransferenciaInput) =>
      apiFetch<MovimentacaoEstoque>(`${INV}/transferir/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movementKeys.all })
    },
  })
}

// ─── Perda ────────────────────────────────────────────────────────────────────

export function usePerda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PerdaInput) =>
      apiFetch<MovimentacaoEstoque>(`${INV}/perda/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movementKeys.all })
    },
  })
}

// ─── Aprovacoes ───────────────────────────────────────────────────────────────

export function useAprovacoesPendentes() {
  return useQuery<MovimentacaoEstoque[]>({
    queryKey: movementKeys.aprovacoesPendentes(),
    queryFn: () =>
      fetchList<MovimentacaoEstoque>(`${INV}/aprovacoes/pendentes/`),
  })
}

export function useAprovar(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<MovimentacaoEstoque>(`${INV}/aprovacoes/${id}/aprovar/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movementKeys.all })
    },
  })
}

export function useRejeitar(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<MovimentacaoEstoque>(`${INV}/aprovacoes/${id}/rejeitar/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: movementKeys.all })
    },
  })
}
