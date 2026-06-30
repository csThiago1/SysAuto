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

import { apiFetch, fetchList } from "@/lib/api"
import { useCreate } from "@/lib/crud-mutations"

const INV = "/api/proxy/inventory"

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

const MOV_OPTS = { invalidateKey: movementKeys.all }

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

// ─── Movimentações que postam payload JSON ────────────────────────────────────

export const useEntradaPeca = () =>
  useCreate<MovimentacaoEstoque, EntradaPecaInput>("inventory/entrada/peca", MOV_OPTS)
export const useEntradaLote = () =>
  useCreate<MovimentacaoEstoque, EntradaLoteInput>("inventory/entrada/lote", MOV_OPTS)
export const useTransferir = () =>
  useCreate<MovimentacaoEstoque, TransferenciaInput>("inventory/transferir", MOV_OPTS)
export const usePerda = () =>
  useCreate<MovimentacaoEstoque, PerdaInput>("inventory/perda", MOV_OPTS)

// ─── Ações sem body (id já vai na URL) ────────────────────────────────────────
// Estas não fitam no useCreate (que sempre stringify-a body). Mantidas à mão.

export function useDevolucao(unidadeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<MovimentacaoEstoque>(`${INV}/devolucao/${unidadeId}/`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: movementKeys.all }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: movementKeys.all }),
  })
}

export function useRejeitar(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<MovimentacaoEstoque>(`${INV}/aprovacoes/${id}/rejeitar/`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: movementKeys.all }),
  })
}
