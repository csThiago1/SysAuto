/**
 * Hooks para catálogo técnico (MO-2): ServicoCanonico, PecaCanonica,
 * MaterialCanonico, InsumoMaterial, CategoriaMaoObra, AliasServico.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AliasMatch,
  AliasServico,
  CategoriaMaoObra,
  CategoriaServico,
  Fornecedor,
  InsumoMaterial,
  MaterialCanonico,
  PecaCanonica,
  ServicoCanonico,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const BASE = "/api/proxy/pricing/catalog"

// ─── Helper: extrai .results de envelope DRF paginado ─────────────────────────

type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null }

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<Paginated<T> | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const catalogKeys = {
  categoriasServico: ["catalog", "categorias-servico"] as const,
  categoriaServico: (id: string) => ["catalog", "categorias-servico", id] as const,
  servicos: (search?: string) => ["catalog", "servicos", search ?? ""] as const,
  servico: (id: string) => ["catalog", "servicos", id] as const,
  matchServico: (texto: string) => ["catalog", "servicos", "match", texto] as const,
  categoriasMaoObra: ["catalog", "categorias-mao-obra"] as const,
  materiais: (search?: string) => ["catalog", "materiais", search ?? ""] as const,
  material: (id: string) => ["catalog", "materiais", id] as const,
  matchMaterial: (texto: string) => ["catalog", "materiais", "match", texto] as const,
  insumos: (materialId?: string) => ["catalog", "insumos", materialId ?? ""] as const,
  insumoByGtin: (gtin: string) => ["catalog", "insumos", "gtin", gtin] as const,
  pecas: (search?: string) => ["catalog", "pecas", search ?? ""] as const,
  peca: (id: string) => ["catalog", "pecas", id] as const,
  matchPeca: (texto: string) => ["catalog", "pecas", "match", texto] as const,
  fornecedores: ["catalog", "fornecedores"] as const,
  aliasesRevisao: ["catalog", "aliases", "revisao"] as const,
}

// ─── Categorias de Serviço ────────────────────────────────────────────────────

export function useCategoriasServico() {
  return useQuery<CategoriaServico[]>({
    queryKey: catalogKeys.categoriasServico,
    queryFn: () => fetchList<CategoriaServico>(`${BASE}/categorias-servico/`),
    staleTime: 10 * 60 * 1000,
  })
}

// ─── Serviços Canônicos ───────────────────────────────────────────────────────

export function useServicosCanonico(search?: string) {
  const params = search ? `?busca=${encodeURIComponent(search)}` : ""
  return useQuery<ServicoCanonico[]>({
    queryKey: catalogKeys.servicos(search),
    queryFn: () => fetchList<ServicoCanonico>(`${BASE}/servicos/${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useMatchServico(texto: string) {
  return useQuery<AliasMatch[]>({
    queryKey: catalogKeys.matchServico(texto),
    queryFn: () =>
      apiFetch<AliasMatch[]>(`${BASE}/servicos/match/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      }),
    enabled: texto.length >= 3,
    staleTime: 60_000,
  })
}

export interface ServicoCanonicoPaylod {
  codigo: string
  nome: string
  categoria: string
  unidade?: string
  descricao?: string
  aplica_multiplicador_tamanho?: boolean
  is_active?: boolean
}

export function useCreateServicoCanonico() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ServicoCanonicoPaylod) =>
      apiFetch<ServicoCanonico>(`${BASE}/servicos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.servicos() }),
  })
}

export function useUpdateServicoCanonico(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ServicoCanonicoPaylod>) =>
      apiFetch<ServicoCanonico>(`${BASE}/servicos/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.servicos() })
      qc.invalidateQueries({ queryKey: catalogKeys.servico(id) })
    },
  })
}

// ─── Categorias de Mão de Obra ────────────────────────────────────────────────

export function useCategoriasMaoObra() {
  return useQuery<CategoriaMaoObra[]>({
    queryKey: catalogKeys.categoriasMaoObra,
    queryFn: () => fetchList<CategoriaMaoObra>(`${BASE}/categorias-mao-obra/`),
    staleTime: 10 * 60 * 1000,
  })
}

// ─── Materiais Canônicos ──────────────────────────────────────────────────────

export function useMateriaisCanonico(search?: string) {
  const params = search ? `?busca=${encodeURIComponent(search)}` : ""
  return useQuery<MaterialCanonico[]>({
    queryKey: catalogKeys.materiais(search),
    queryFn: () => fetchList<MaterialCanonico>(`${BASE}/materiais/${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useMatchMaterial(texto: string) {
  return useQuery<AliasMatch[]>({
    queryKey: catalogKeys.matchMaterial(texto),
    queryFn: () =>
      apiFetch<AliasMatch[]>(`${BASE}/materiais/match/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      }),
    enabled: texto.length >= 3,
    staleTime: 60_000,
  })
}

export interface MaterialCanonicoPaylod {
  codigo: string
  nome: string
  unidade_base: string
  tipo?: 'consumivel' | 'ferramenta'
  is_active?: boolean
}

export function useCreateMaterialCanonico() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MaterialCanonicoPaylod) =>
      apiFetch<MaterialCanonico>(`${BASE}/materiais/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.materiais() }),
  })
}

// ─── Insumos de Material ──────────────────────────────────────────────────────

export function useInsumosMaterial(materialId?: string) {
  const params = materialId ? `?material_canonico=${encodeURIComponent(materialId)}` : ""
  return useQuery<InsumoMaterial[]>({
    queryKey: catalogKeys.insumos(materialId),
    queryFn: () => fetchList<InsumoMaterial>(`${BASE}/insumos/${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useInsumoByGtin(gtin: string) {
  return useQuery<InsumoMaterial>({
    queryKey: catalogKeys.insumoByGtin(gtin),
    queryFn: () =>
      apiFetch<InsumoMaterial>(`${BASE}/insumos/by-gtin/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gtin }),
      }),
    enabled: gtin.length >= 8,
    staleTime: 5 * 60 * 1000,
  })
}

export interface InsumoMaterialPayload {
  material_canonico: string
  sku_interno: string
  gtin?: string
  descricao: string
  marca?: string
  unidade_compra: string
  fator_conversao: string
  is_active?: boolean
}

export function useCreateInsumoMaterial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: InsumoMaterialPayload) =>
      apiFetch<InsumoMaterial>(`${BASE}/insumos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.insumos() }),
  })
}

// ─── Peças Canônicas ──────────────────────────────────────────────────────────

export function usePecasCanonicas(search?: string) {
  const params = search ? `?busca=${encodeURIComponent(search)}` : ""
  return useQuery<PecaCanonica[]>({
    queryKey: catalogKeys.pecas(search),
    queryFn: () => fetchList<PecaCanonica>(`${BASE}/pecas/${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useMatchPeca(texto: string) {
  return useQuery<AliasMatch[]>({
    queryKey: catalogKeys.matchPeca(texto),
    queryFn: () =>
      apiFetch<AliasMatch[]>(`${BASE}/pecas/match/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      }),
    enabled: texto.length >= 3,
    staleTime: 60_000,
  })
}

export interface PecaCanonicoPayload {
  codigo: string
  nome: string
  tipo_peca?: 'genuina' | 'original' | 'paralela' | 'usada' | 'recondicionada'
  /** NCM 8 dígitos para NF-e de produto. Ex: "87089990" */
  ncm?: string
  is_active?: boolean
}

export function useCreatePecaCanonica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PecaCanonicoPayload) =>
      apiFetch<PecaCanonica>(`${BASE}/pecas/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.pecas() }),
  })
}

export function useUpdatePecaCanonica() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: PecaCanonicoPayload & { id: string }) =>
      apiFetch<PecaCanonica>(`${BASE}/pecas/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.pecas() }),
  })
}

// ─── Fornecedores ─────────────────────────────────────────────────────────────

export function useFornecedores() {
  return useQuery<Fornecedor[]>({
    queryKey: catalogKeys.fornecedores,
    queryFn: () => fetchList<Fornecedor>(`${BASE}/fornecedores/`),
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Aliases de Serviço — Fila de Revisão ─────────────────────────────────────

export function useAliasesServicoRevisao() {
  return useQuery<AliasServico[]>({
    queryKey: catalogKeys.aliasesRevisao,
    queryFn: () => fetchList<AliasServico>(`${BASE}/aliases/servico/revisao/`),
    staleTime: 60_000,
  })
}

export function useApproveAlias() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<AliasServico>(`${BASE}/aliases/servico/${id}/approve/`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.aliasesRevisao }),
  })
}

export function useRejectAlias() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${BASE}/aliases/servico/${id}/reject/`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.aliasesRevisao }),
  })
}
