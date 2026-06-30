/**
 * Hooks para CRUD do perfil veicular (Motor de Orçamentos — MO-1).
 * Cobre: Empresas, Segmentos Veiculares, Categorias de Tamanho, Tipos de Pintura,
 * e Enquadramentos de Veículo.
 */

import { useQuery } from "@tanstack/react-query"
import type {
  Empresa,
  SegmentoVeicular,
  CategoriaTamanho,
  TipoPintura,
  EnquadramentoVeiculo,
} from "@paddock/types"

import { apiFetch, fetchList } from "@/lib/api"
import { useCreate, useDelete, useUpdate } from "@/lib/crud-mutations"

const BASE = "/api/proxy/pricing"

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

const EMPRESAS_OPTS = { invalidateKey: pricingKeys.empresas }
export const useCreateEmpresa = () =>
  useCreate<Empresa, EmpresaPayload>("pricing/empresas", EMPRESAS_OPTS)
export const useUpdateEmpresa = () =>
  useUpdate<Empresa, Partial<EmpresaPayload>>("pricing/empresas", EMPRESAS_OPTS)

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

const SEGMENTOS_OPTS = { invalidateKey: pricingKeys.segmentos }
export const useCreateSegmento = () =>
  useCreate<SegmentoVeicular, SegmentoPayload>("pricing/segmentos", SEGMENTOS_OPTS)
export const useUpdateSegmento = () =>
  useUpdate<SegmentoVeicular, Partial<SegmentoPayload>>("pricing/segmentos", SEGMENTOS_OPTS)

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

const TAMANHOS_OPTS = { invalidateKey: pricingKeys.tamanhos }
export const useCreateTamanho = () =>
  useCreate<CategoriaTamanho, TamanhoPayload>("pricing/tamanhos", TAMANHOS_OPTS)
export const useUpdateTamanho = () =>
  useUpdate<CategoriaTamanho, Partial<TamanhoPayload>>("pricing/tamanhos", TAMANHOS_OPTS)

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

const TIPOS_PINTURA_OPTS = { invalidateKey: pricingKeys.tiposPintura }
export const useCreateTipoPintura = () =>
  useCreate<TipoPintura, TipoPinturaPayload>("pricing/tipos-pintura", TIPOS_PINTURA_OPTS)
export const useUpdateTipoPintura = () =>
  useUpdate<TipoPintura, Partial<TipoPinturaPayload>>("pricing/tipos-pintura", TIPOS_PINTURA_OPTS)

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

const ENQUADRAMENTOS_OPTS = { invalidateKey: ["pricing", "enquadramentos"] }
export const useCreateEnquadramento = () =>
  useCreate<EnquadramentoVeiculo, EnquadramentoPayload>("pricing/enquadramentos", ENQUADRAMENTOS_OPTS)
export const useUpdateEnquadramento = () =>
  useUpdate<EnquadramentoVeiculo, Partial<EnquadramentoPayload>>("pricing/enquadramentos", ENQUADRAMENTOS_OPTS)
export const useDeleteEnquadramento = () =>
  useDelete("pricing/enquadramentos", ENQUADRAMENTOS_OPTS)
