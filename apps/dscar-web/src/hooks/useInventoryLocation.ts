/**
 * Paddock Solutions — dscar-web
 * WMS: Hooks TanStack Query v5 para Hierarquia de Localização
 * Armazem, Rua, Prateleira, Nivel
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  Armazem,
  Nivel,
  NivelConteudo,
  OcupacaoRua,
  Prateleira,
  Rua,
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
      apiFetch<OcupacaoRua[]>(`${INV}/armazens/${id}/ocupacao/`),
    enabled: !!id,
  })
}

export function useArmazemCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Armazem>) =>
      apiFetch<Armazem>(`${INV}/armazens/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.armazens() }),
  })
}

export function useArmazemUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Armazem>) =>
      apiFetch<Armazem>(`${INV}/armazens/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.armazens() })
      qc.invalidateQueries({ queryKey: locationKeys.armazem(id) })
    },
  })
}

export function useArmazemDelete(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`${INV}/armazens/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.armazens() }),
  })
}

// ─── Rua ──────────────────────────────────────────────────────────────────────

export function useRuas(armazemId?: string) {
  const qs = armazemId ? `?armazem=${armazemId}` : ""
  return useQuery<Rua[]>({
    queryKey: locationKeys.ruas(armazemId),
    queryFn: () => fetchList<Rua>(`${INV}/ruas/${qs}`),
  })
}

export function useRuaCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Rua>) =>
      apiFetch<Rua>(`${INV}/ruas/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.ruas() })
      qc.invalidateQueries({ queryKey: locationKeys.armazens() })
    },
  })
}

// ─── Prateleira ───────────────────────────────────────────────────────────────

export function usePrateleiras(ruaId?: string) {
  const qs = ruaId ? `?rua=${ruaId}` : ""
  return useQuery<Prateleira[]>({
    queryKey: locationKeys.prateleiras(ruaId),
    queryFn: () => fetchList<Prateleira>(`${INV}/prateleiras/${qs}`),
  })
}

export function usePrateleiraCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Prateleira>) =>
      apiFetch<Prateleira>(`${INV}/prateleiras/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.prateleiras() })
      qc.invalidateQueries({ queryKey: locationKeys.ruas() })
    },
  })
}

// ─── Nivel ────────────────────────────────────────────────────────────────────

export function useNiveis(prateleiraId?: string) {
  const qs = prateleiraId ? `?prateleira=${prateleiraId}` : ""
  return useQuery<Nivel[]>({
    queryKey: locationKeys.niveis(prateleiraId),
    queryFn: () => fetchList<Nivel>(`${INV}/niveis/${qs}`),
  })
}

export function useNivelCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Nivel>) =>
      apiFetch<Nivel>(`${INV}/niveis/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.niveis() })
      qc.invalidateQueries({ queryKey: locationKeys.prateleiras() })
    },
  })
}

export function useNivelConteudo(id: string) {
  return useQuery<NivelConteudo>({
    queryKey: locationKeys.nivelConteudo(id),
    queryFn: () => apiFetch<NivelConteudo>(`${INV}/niveis/${id}/conteudo/`),
    enabled: !!id,
  })
}
