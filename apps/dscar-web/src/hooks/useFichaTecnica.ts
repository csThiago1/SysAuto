/**
 * Hooks para fichas técnicas versionadas (Motor de Orçamentos — MO-4).
 * Cobre: listagem, detalhe, histórico de versões, resolver ficha e criar nova versão.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  FichaTecnicaServico,
  FichaResolvida,
  NovaVersaoPayload,
  ResolverFichaPayload,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const BASE = "/api/proxy/pricing"

// ─── Helper: extrai .results de envelope DRF paginado ─────────────────────────

type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null }

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<Paginated<T> | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const fichaKeys = {
  fichas: (servicoId?: string) => ["fichas-tecnicas", servicoId ?? "all"] as const,
  ficha: (id: string) => ["fichas-tecnicas", "detail", id] as const,
  historico: (servicoId: string) => ["fichas-tecnicas", "historico", servicoId] as const,
  resolver: (servicoId: string, tipoPinturaCodigo?: string) =>
    ["fichas-tecnicas", "resolver", servicoId, tipoPinturaCodigo ?? ""] as const,
}

// ─── useFichas ─────────────────────────────────────────────────────────────────
// Lista fichas ativas, opcionalmente filtradas por serviço

export function useFichas(servicoId?: string) {
  const params = servicoId ? `?servico=${encodeURIComponent(servicoId)}` : ""
  return useQuery<FichaTecnicaServico[]>({
    queryKey: fichaKeys.fichas(servicoId),
    queryFn: () => fetchList<FichaTecnicaServico>(`${BASE}/fichas/${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

// ─── useFicha ──────────────────────────────────────────────────────────────────
// Detalhe de uma ficha específica (inclui maos_obra e insumos)

export function useFicha(id: string) {
  return useQuery<FichaTecnicaServico>({
    queryKey: fichaKeys.ficha(id),
    queryFn: () => apiFetch<FichaTecnicaServico>(`${BASE}/fichas/${id}/`),
    enabled: !!id,
  })
}

// ─── useFichasHistorico ────────────────────────────────────────────────────────
// Histórico de todas as versões (ativas e inativas) de um serviço

export function useFichasHistorico(servicoId: string) {
  return useQuery<FichaTecnicaServico[]>({
    queryKey: fichaKeys.historico(servicoId),
    queryFn: () =>
      fetchList<FichaTecnicaServico>(
        `${BASE}/fichas/?servico=${encodeURIComponent(servicoId)}&all=true`
      ),
    enabled: !!servicoId,
    staleTime: 2 * 60 * 1000,
  })
}

// ─── useFichaResolver ──────────────────────────────────────────────────────────
// Resolve a ficha ativa para um serviço via POST /fichas/resolver/

export function useFichaResolver(servicoId: string, tipoPinturaCodigo?: string) {
  return useQuery<FichaResolvida>({
    queryKey: fichaKeys.resolver(servicoId, tipoPinturaCodigo),
    queryFn: async () => {
      const payload: ResolverFichaPayload = {
        servico_id: servicoId,
        tipo_pintura_codigo: tipoPinturaCodigo ?? null,
      }
      return apiFetch<FichaResolvida>(`${BASE}/fichas/resolver/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
    enabled: !!servicoId,
    staleTime: 5 * 60 * 1000,
    retry: false, // FichaNaoEncontrada é um 404 esperado — não retry
  })
}

// ─── useNovaVersao ─────────────────────────────────────────────────────────────
// Cria nova versão de ficha via POST /fichas/{id}/nova-versao/

export function useNovaVersao(fichaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: NovaVersaoPayload) =>
      apiFetch<FichaTecnicaServico>(`${BASE}/fichas/${fichaId}/nova-versao/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (novaFicha) => {
      // Invalida listas e histórico
      qc.invalidateQueries({ queryKey: ["fichas-tecnicas"] })
      // Atualiza cache do detalhe da nova ficha
      qc.setQueryData(fichaKeys.ficha(novaFicha.id), novaFicha)
    },
  })
}
