/**
 * Hooks para CRUD do perfil veicular (Motor de Orçamentos — MO-1).
 * Cobre: Empresas, Segmentos Veiculares, Categorias de Tamanho, Tipos de Pintura,
 * e Enquadramentos de Veículo.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  Empresa,
  SegmentoVeicular,
  CategoriaTamanho,
  TipoPintura,
  EnquadramentoVeiculo,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const BASE = "/api/proxy/pricing"

type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null }

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<Paginated<T> | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const pricingKeys = {
  empresas: ["pricing", "empresas"] as const,
  empresa: (id: string) => ["pricing", "empresas", id] as const,
  segmentos: ["pricing", "segmentos"] as const,
  segmento: (id: string) => ["pricing", "segmentos", id] as const,
  tamanhos: ["pricing", "tamanhos"] as const,
  tamanho: (id: string) => ["pricing", "tamanhos", id] as const,
  tiposPintura: ["pricing", "tipos-pintura"] as const,
  tipoPintura: (id: string) => ["pricing", "tipos-pintura", id] as const,
  enquadramentos: (query?: string) =>
    ["pricing", "enquadramentos", query ?? ""] as const,
  enquadramento: (id: string) => ["pricing", "enquadramentos", id] as const,
}

// ─── Empresas ─────────────────────────────────────────────────────────────────

export function useEmpresas() {
  return useQuery<Empresa[]>({
    queryKey: pricingKeys.empresas,
    queryFn: () => fetchList<Empresa>(`${BASE}/empresas/`),
    staleTime: 5 * 60 * 1000,
  })
}

/** Retorna o UUID da primeira empresa ativa do tenant. String vazia enquanto carrega. */
export function useMinhaEmpresaId(): string {
  const { data: empresas = [] } = useEmpresas()
  return empresas.find((e) => e.is_active)?.id ?? empresas[0]?.id ?? ""
}

export function useEmpresa(id: string) {
  return useQuery<Empresa>({
    queryKey: pricingKeys.empresa(id),
    queryFn: () => apiFetch<Empresa>(`${BASE}/empresas/${id}/`),
    enabled: !!id,
  })
}

export interface EmpresaPayload {
  cnpj: string
  nome_fantasia: string
  razao_social: string
  inscricao_estadual?: string
  is_active?: boolean
}

export function useCreateEmpresa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EmpresaPayload) =>
      apiFetch<Empresa>(`${BASE}/empresas/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.empresas }),
  })
}

export function useUpdateEmpresa(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<EmpresaPayload>) =>
      apiFetch<Empresa>(`${BASE}/empresas/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.empresas }),
  })
}

// ─── Segmentos Veiculares ─────────────────────────────────────────────────────

export function useSegmentos() {
  return useQuery<SegmentoVeicular[]>({
    queryKey: pricingKeys.segmentos,
    queryFn: () => fetchList<SegmentoVeicular>(`${BASE}/segmentos/`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useSegmento(id: string) {
  return useQuery<SegmentoVeicular>({
    queryKey: pricingKeys.segmento(id),
    queryFn: () => apiFetch<SegmentoVeicular>(`${BASE}/segmentos/${id}/`),
    enabled: !!id,
  })
}

export interface SegmentoPayload {
  codigo: string
  nome: string
  ordem?: number
  fator_responsabilidade: string
  descricao?: string
  is_active?: boolean
}

export function useCreateSegmento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SegmentoPayload) =>
      apiFetch<SegmentoVeicular>(`${BASE}/segmentos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.segmentos }),
  })
}

export function useUpdateSegmento(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<SegmentoPayload>) =>
      apiFetch<SegmentoVeicular>(`${BASE}/segmentos/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.segmentos }),
  })
}

// ─── Categorias de Tamanho ────────────────────────────────────────────────────

export function useTamanhos() {
  return useQuery<CategoriaTamanho[]>({
    queryKey: pricingKeys.tamanhos,
    queryFn: () => fetchList<CategoriaTamanho>(`${BASE}/tamanhos/`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTamanho(id: string) {
  return useQuery<CategoriaTamanho>({
    queryKey: pricingKeys.tamanho(id),
    queryFn: () => apiFetch<CategoriaTamanho>(`${BASE}/tamanhos/${id}/`),
    enabled: !!id,
  })
}

export interface TamanhoPayload {
  codigo: string
  nome: string
  ordem?: number
  multiplicador_insumos: string
  multiplicador_horas: string
  is_active?: boolean
}

export function useCreateTamanho() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TamanhoPayload) =>
      apiFetch<CategoriaTamanho>(`${BASE}/tamanhos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.tamanhos }),
  })
}

export function useUpdateTamanho(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<TamanhoPayload>) =>
      apiFetch<CategoriaTamanho>(`${BASE}/tamanhos/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.tamanhos }),
  })
}

// ─── Tipos de Pintura ─────────────────────────────────────────────────────────

export function useTiposPintura() {
  return useQuery<TipoPintura[]>({
    queryKey: pricingKeys.tiposPintura,
    queryFn: () => fetchList<TipoPintura>(`${BASE}/tipos-pintura/`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTipoPintura(id: string) {
  return useQuery<TipoPintura>({
    queryKey: pricingKeys.tipoPintura(id),
    queryFn: () => apiFetch<TipoPintura>(`${BASE}/tipos-pintura/${id}/`),
    enabled: !!id,
  })
}

export interface TipoPinturaPayload {
  codigo: string
  nome: string
  complexidade?: number
  is_active?: boolean
}

export function useCreateTipoPintura() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TipoPinturaPayload) =>
      apiFetch<TipoPintura>(`${BASE}/tipos-pintura/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.tiposPintura }),
  })
}

export function useUpdateTipoPintura(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<TipoPinturaPayload>) =>
      apiFetch<TipoPintura>(`${BASE}/tipos-pintura/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: pricingKeys.tiposPintura }),
  })
}

// ─── Enquadramentos de Veículo ────────────────────────────────────────────────

export function useEnquadramentos(search?: string) {
  const params = search ? `?search=${encodeURIComponent(search)}` : ""
  return useQuery<EnquadramentoVeiculo[]>({
    queryKey: pricingKeys.enquadramentos(search),
    queryFn: () => fetchList<EnquadramentoVeiculo>(`${BASE}/enquadramentos/${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useEnquadramento(id: string) {
  return useQuery<EnquadramentoVeiculo>({
    queryKey: pricingKeys.enquadramento(id),
    queryFn: () =>
      apiFetch<EnquadramentoVeiculo>(`${BASE}/enquadramentos/${id}/`),
    enabled: !!id,
  })
}

export interface EnquadramentoPayload {
  marca: string
  modelo: string
  ano_inicio?: number | null
  ano_fim?: number | null
  segmento_codigo: string
  tamanho_codigo: string
  tipo_pintura_codigo?: string | null
  prioridade?: number
  is_active?: boolean
}

export function useCreateEnquadramento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EnquadramentoPayload) =>
      apiFetch<EnquadramentoVeiculo>(`${BASE}/enquadramentos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingKeys.enquadramentos() }),
  })
}

export function useUpdateEnquadramento(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<EnquadramentoPayload>) =>
      apiFetch<EnquadramentoVeiculo>(`${BASE}/enquadramentos/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingKeys.enquadramentos() }),
  })
}

export function useDeleteEnquadramento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${BASE}/enquadramentos/${id}/`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: pricingKeys.enquadramentos() }),
  })
}
