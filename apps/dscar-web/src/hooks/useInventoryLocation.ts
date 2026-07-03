/**
 * Paddock Solutions — dscar-web
 * WMS: Hooks TanStack Query v5 para Hierarquia de Localização
 * Armazem, Rua, Prateleira, Nivel
 */
import { useQuery } from "@tanstack/react-query"
import type { NivelConteudo, OcupacaoRua } from "@paddock/types"

import { apiFetch, fetchList } from "@/lib/api"
import { useCreate, useDelete, useUpdate } from "@/lib/crud-mutations"
import type { ApiSchema } from "@/types"

// Gerados dos ModelSerializers. NivelConteudo/OcupacaoRua ficam
// manuais (actions custom sem serializer dedicado).
export type Armazem = ApiSchema<"Armazem">
export type Rua = ApiSchema<"Rua">
export type Prateleira = ApiSchema<"Prateleira">
export type Nivel = ApiSchema<"Nivel">

const INV = "/api/proxy/inventory"

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const locationKeys = {
  all: ["inventory-location"] as const,
  armazens: () => [...locationKeys.all, "armazens"] as const,
  armazem: (id: string) => [...locationKeys.all, "armazem", id] as const,
  armazemOcupacao: (id: string) =>
    [...locationKeys.all, "armazem-ocupacao", id] as const,
  ruas: (armazemId?: string) =>
    [...locationKeys.all, "ruas", armazemId] as const,
  prateleiras: (ruaId?: string) =>
    [...locationKeys.all, "prateleiras", ruaId] as const,
  niveis: (prateleiraId?: string) =>
    [...locationKeys.all, "niveis", prateleiraId] as const,
  nivelConteudo: (id: string) =>
    [...locationKeys.all, "nivel-conteudo", id] as const,
}

// Toda mutation invalida `locationKeys.all` — todo cache de location
// já é prefixado por essa key, então invalida tudo de uma vez (rua afeta
// ocupação do armazém, etc). Custo: refetches a mais, ganho: zero risco
// de cache stale em hierarquias aninhadas.
const LOC_OPTS = { invalidateKey: locationKeys.all }

// ─── Armazem ──────────────────────────────────────────────────────────────────

export function useArmazens() {
  return useQuery<Armazem[]>({
    queryKey: locationKeys.armazens(),
    queryFn: () => fetchList<Armazem>(`${INV}/armazens/`),
  })
}

export function useArmazem(id: string) {
  return useQuery<Armazem>({
    queryKey: locationKeys.armazem(id),
    queryFn: () => apiFetch<Armazem>(`${INV}/armazens/${id}/`),
    enabled: !!id,
  })
}

export function useArmazemOcupacao(id: string) {
  return useQuery<OcupacaoRua[]>({
    queryKey: locationKeys.armazemOcupacao(id),
    queryFn: () =>
      fetchList<OcupacaoRua>(`${INV}/armazens/${id}/ocupacao/`),
    enabled: !!id,
  })
}

export const useArmazemCreate = () =>
  useCreate<Armazem, Partial<Armazem>>("inventory/armazens", LOC_OPTS)
export const useArmazemUpdate = () =>
  useUpdate<Armazem, Partial<Armazem>>("inventory/armazens", LOC_OPTS)
export const useArmazemDelete = () =>
  useDelete("inventory/armazens", LOC_OPTS)

// ─── Rua ──────────────────────────────────────────────────────────────────────

export function useRuas(armazemId?: string) {
  const qs = armazemId ? `?armazem=${armazemId}` : ""
  return useQuery<Rua[]>({
    queryKey: locationKeys.ruas(armazemId),
    queryFn: () => fetchList<Rua>(`${INV}/ruas/${qs}`),
  })
}

export const useRuaCreate = () =>
  useCreate<Rua, Partial<Rua>>("inventory/ruas", LOC_OPTS)

// ─── Prateleira ───────────────────────────────────────────────────────────────

export function usePrateleiras(ruaId?: string) {
  const qs = ruaId ? `?rua=${ruaId}` : ""
  return useQuery<Prateleira[]>({
    queryKey: locationKeys.prateleiras(ruaId),
    queryFn: () => fetchList<Prateleira>(`${INV}/prateleiras/${qs}`),
  })
}

export const usePrateleiraCreate = () =>
  useCreate<Prateleira, Partial<Prateleira>>("inventory/prateleiras", LOC_OPTS)

// ─── Nivel ────────────────────────────────────────────────────────────────────

export function useNiveis(prateleiraId?: string) {
  const qs = prateleiraId ? `?prateleira=${prateleiraId}` : ""
  return useQuery<Nivel[]>({
    queryKey: locationKeys.niveis(prateleiraId),
    queryFn: () => fetchList<Nivel>(`${INV}/niveis/${qs}`),
  })
}

export const useNivelCreate = () =>
  useCreate<Nivel, Partial<Nivel>>("inventory/niveis", LOC_OPTS)

export function useNivelConteudo(id: string) {
  return useQuery<NivelConteudo>({
    queryKey: locationKeys.nivelConteudo(id),
    queryFn: () => apiFetch<NivelConteudo>(`${INV}/niveis/${id}/conteudo/`),
    enabled: !!id,
  })
}
