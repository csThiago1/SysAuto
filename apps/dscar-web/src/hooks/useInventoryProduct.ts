/**
 * Paddock Solutions — dscar-web
 * WMS: Hooks TanStack Query v5 para Produtos Comerciais
 * TipoPeca, CategoriaProduto, CategoriaInsumo, ProdutoComercialPeca,
 * ProdutoComercialInsumo
 */
import { useQuery } from "@tanstack/react-query"
import type {
  CategoriaInsumo,
  CategoriaProduto,
  ProdutoComercialInsumo,
  ProdutoComercialPeca,
  TipoPeca,
} from "@paddock/types"

import { apiFetch, fetchList } from "@/lib/api"
import { useCreate, useDelete, useUpdate } from "@/lib/crud-mutations"

const INV = "/api/proxy/inventory"

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

const TIPO_PECA_OPTS = { invalidateKey: productKeys.tiposPeca() }
export const useTipoPecaCreate = () =>
  useCreate<TipoPeca, Partial<TipoPeca>>("inventory/tipos-peca", TIPO_PECA_OPTS)
export const useTipoPecaUpdate = () =>
  useUpdate<TipoPeca, Partial<TipoPeca>>("inventory/tipos-peca", TIPO_PECA_OPTS)
export const useTipoPecaDelete = () =>
  useDelete("inventory/tipos-peca", TIPO_PECA_OPTS)

// ─── CategoriaProduto ─────────────────────────────────────────────────────────

export function useCategoriasProduto() {
  return useQuery<CategoriaProduto[]>({
    queryKey: productKeys.categoriasProduto(),
    queryFn: () => fetchList<CategoriaProduto>(`${INV}/categorias-produto/`),
  })
}

const CAT_PROD_OPTS = { invalidateKey: productKeys.categoriasProduto() }
export const useCategoriaProdutoCreate = () =>
  useCreate<CategoriaProduto, Partial<CategoriaProduto>>("inventory/categorias-produto", CAT_PROD_OPTS)
export const useCategoriaProdutoUpdate = () =>
  useUpdate<CategoriaProduto, Partial<CategoriaProduto>>("inventory/categorias-produto", CAT_PROD_OPTS)
export const useCategoriaProdutoDelete = () =>
  useDelete("inventory/categorias-produto", CAT_PROD_OPTS)

// ─── CategoriaInsumo ──────────────────────────────────────────────────────────

export function useCategoriasInsumo() {
  return useQuery<CategoriaInsumo[]>({
    queryKey: productKeys.categoriasInsumo(),
    queryFn: () => fetchList<CategoriaInsumo>(`${INV}/categorias-insumo/`),
  })
}

const CAT_INS_OPTS = { invalidateKey: productKeys.categoriasInsumo() }
export const useCategoriaInsumoCreate = () =>
  useCreate<CategoriaInsumo, Partial<CategoriaInsumo>>("inventory/categorias-insumo", CAT_INS_OPTS)
export const useCategoriaInsumoUpdate = () =>
  useUpdate<CategoriaInsumo, Partial<CategoriaInsumo>>("inventory/categorias-insumo", CAT_INS_OPTS)
export const useCategoriaInsumoDelete = () =>
  useDelete("inventory/categorias-insumo", CAT_INS_OPTS)

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

const PROD_PECA_OPTS = { invalidateKey: ["inventory-product", "produtos-peca"] }
export const useProdutoPecaCreate = () =>
  useCreate<ProdutoComercialPeca, Partial<ProdutoComercialPeca>>(
    "inventory/produtos-peca",
    PROD_PECA_OPTS,
  )
export const useProdutoPecaUpdate = () =>
  useUpdate<ProdutoComercialPeca, Partial<ProdutoComercialPeca>>(
    "inventory/produtos-peca",
    PROD_PECA_OPTS,
  )
export const useProdutoPecaDelete = () =>
  useDelete("inventory/produtos-peca", PROD_PECA_OPTS)

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

const PROD_INS_OPTS = { invalidateKey: ["inventory-product", "produtos-insumo"] }
export const useProdutoInsumoCreate = () =>
  useCreate<ProdutoComercialInsumo, Partial<ProdutoComercialInsumo>>(
    "inventory/produtos-insumo",
    PROD_INS_OPTS,
  )
export const useProdutoInsumoUpdate = () =>
  useUpdate<ProdutoComercialInsumo, Partial<ProdutoComercialInsumo>>(
    "inventory/produtos-insumo",
    PROD_INS_OPTS,
  )
export const useProdutoInsumoDelete = () =>
  useDelete("inventory/produtos-insumo", PROD_INS_OPTS)
