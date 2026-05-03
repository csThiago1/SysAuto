/**
 * Paddock Solutions — dscar-web
 * WMS: Hooks TanStack Query v5 para Produtos Comerciais
 * TipoPeca, CategoriaProduto, CategoriaInsumo, ProdutoComercialPeca, ProdutoComercialInsumo
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  CategoriaInsumo,
  CategoriaProduto,
  ProdutoComercialInsumo,
  ProdutoComercialPeca,
  TipoPeca,
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

export const productKeys = {
  all: ["inventory-product"] as const,
  tiposPeca: () => [...productKeys.all, "tipos-peca"] as const,
  categoriasProduto: () => [...productKeys.all, "categorias-produto"] as const,
  categoriasInsumo: () => [...productKeys.all, "categorias-insumo"] as const,
  produtosPeca: (params?: Record<string, string>) =>
    [...productKeys.all, "produtos-peca", params] as const,
  produtoPeca: (id: string) => [...productKeys.all, "produto-peca", id] as const,
  produtosInsumo: (params?: Record<string, string>) =>
    [...productKeys.all, "produtos-insumo", params] as const,
  produtoInsumo: (id: string) =>
    [...productKeys.all, "produto-insumo", id] as const,
}

// ─── TipoPeca ─────────────────────────────────────────────────────────────────

export function useTiposPeca() {
  return useQuery<TipoPeca[]>({
    queryKey: productKeys.tiposPeca(),
    queryFn: () => fetchList<TipoPeca>(`${INV}/tipos-peca/`),
  })
}

export function useTipoPecaCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<TipoPeca>) =>
      apiFetch<TipoPeca>(`${INV}/tipos-peca/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.tiposPeca() }),
  })
}

export function useTipoPecaUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<TipoPeca>) =>
      apiFetch<TipoPeca>(`${INV}/tipos-peca/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.tiposPeca() }),
  })
}

export function useTipoPecaDelete(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`${INV}/tipos-peca/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.tiposPeca() }),
  })
}

// ─── CategoriaProduto ─────────────────────────────────────────────────────────

export function useCategoriasProduto() {
  return useQuery<CategoriaProduto[]>({
    queryKey: productKeys.categoriasProduto(),
    queryFn: () => fetchList<CategoriaProduto>(`${INV}/categorias-produto/`),
  })
}

export function useCategoriaProdutoCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CategoriaProduto>) =>
      apiFetch<CategoriaProduto>(`${INV}/categorias-produto/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasProduto() }),
  })
}

export function useCategoriaProdutoUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CategoriaProduto>) =>
      apiFetch<CategoriaProduto>(`${INV}/categorias-produto/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasProduto() }),
  })
}

export function useCategoriaProdutoDelete(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`${INV}/categorias-produto/${id}/`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasProduto() }),
  })
}

// ─── CategoriaInsumo ──────────────────────────────────────────────────────────

export function useCategoriasInsumo() {
  return useQuery<CategoriaInsumo[]>({
    queryKey: productKeys.categoriasInsumo(),
    queryFn: () => fetchList<CategoriaInsumo>(`${INV}/categorias-insumo/`),
  })
}

export function useCategoriaInsumoCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CategoriaInsumo>) =>
      apiFetch<CategoriaInsumo>(`${INV}/categorias-insumo/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasInsumo() }),
  })
}

export function useCategoriaInsumoUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CategoriaInsumo>) =>
      apiFetch<CategoriaInsumo>(`${INV}/categorias-insumo/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasInsumo() }),
  })
}

export function useCategoriaInsumoDelete(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`${INV}/categorias-insumo/${id}/`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.categoriasInsumo() }),
  })
}

// ─── ProdutoComercialPeca ─────────────────────────────────────────────────────

export function useProdutosPeca(params?: Record<string, string>) {
  const qs = new URLSearchParams(params ?? {}).toString()
  return useQuery<ProdutoComercialPeca[]>({
    queryKey: productKeys.produtosPeca(params),
    queryFn: () =>
      fetchList<ProdutoComercialPeca>(
        `${INV}/produtos-peca/${qs ? `?${qs}` : ""}`
      ),
  })
}

export function useProdutoPeca(id: string) {
  return useQuery<ProdutoComercialPeca>({
    queryKey: productKeys.produtoPeca(id),
    queryFn: () =>
      apiFetch<ProdutoComercialPeca>(`${INV}/produtos-peca/${id}/`),
    enabled: !!id,
  })
}

export function useProdutoPecaCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ProdutoComercialPeca>) =>
      apiFetch<ProdutoComercialPeca>(`${INV}/produtos-peca/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.produtosPeca() }),
  })
}

export function useProdutoPecaUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ProdutoComercialPeca>) =>
      apiFetch<ProdutoComercialPeca>(`${INV}/produtos-peca/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.produtosPeca() })
      qc.invalidateQueries({ queryKey: productKeys.produtoPeca(id) })
    },
  })
}

export function useProdutoPecaDelete(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`${INV}/produtos-peca/${id}/`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.produtosPeca() }),
  })
}

// ─── ProdutoComercialInsumo ───────────────────────────────────────────────────

export function useProdutosInsumo(params?: Record<string, string>) {
  const qs = new URLSearchParams(params ?? {}).toString()
  return useQuery<ProdutoComercialInsumo[]>({
    queryKey: productKeys.produtosInsumo(params),
    queryFn: () =>
      fetchList<ProdutoComercialInsumo>(
        `${INV}/produtos-insumo/${qs ? `?${qs}` : ""}`
      ),
  })
}

export function useProdutoInsumo(id: string) {
  return useQuery<ProdutoComercialInsumo>({
    queryKey: productKeys.produtoInsumo(id),
    queryFn: () =>
      apiFetch<ProdutoComercialInsumo>(`${INV}/produtos-insumo/${id}/`),
    enabled: !!id,
  })
}

export function useProdutoInsumoCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ProdutoComercialInsumo>) =>
      apiFetch<ProdutoComercialInsumo>(`${INV}/produtos-insumo/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.produtosInsumo() }),
  })
}

export function useProdutoInsumoUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<ProdutoComercialInsumo>) =>
      apiFetch<ProdutoComercialInsumo>(`${INV}/produtos-insumo/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.produtosInsumo() })
      qc.invalidateQueries({ queryKey: productKeys.produtoInsumo(id) })
    },
  })
}

export function useProdutoInsumoDelete(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`${INV}/produtos-insumo/${id}/`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: productKeys.produtosInsumo() }),
  })
}
