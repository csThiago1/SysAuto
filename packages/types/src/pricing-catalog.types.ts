/**
 * @paddock/types — Motor de Orçamentos (MO-2: Catálogo Técnico)
 * Tipos para serviços canônicos, peças, materiais, insumos, fornecedores e aliases.
 */

// ─── Categoria de Serviço ─────────────────────────────────────────────────────

export interface CategoriaServico {
  id: string
  codigo: string
  nome: string
  ordem: number
  is_active: boolean
}

// ─── Serviço Canônico ─────────────────────────────────────────────────────────

export interface ServicoCanonico {
  id: string
  codigo: string
  nome: string
  categoria: string        // UUID da categoria
  categoria_nome?: string  // SerializerMethodField
  unidade: string
  descricao: string
  aplica_multiplicador_tamanho: boolean
  tem_embedding: boolean
  is_active: boolean
}

// ─── Categoria de Mão de Obra ─────────────────────────────────────────────────

export interface CategoriaMaoObra {
  id: string
  codigo: string
  nome: string
  ordem: number
  is_active: boolean
}

// ─── Material Canônico ────────────────────────────────────────────────────────

export interface MaterialCanonico {
  id: string
  codigo: string
  nome: string
  unidade_base: string
  tipo: 'consumivel' | 'ferramenta'
  tem_embedding: boolean
  is_active: boolean
}

// ─── Insumo Material ─────────────────────────────────────────────────────────

export interface InsumoMaterial {
  id: string
  material_canonico: string  // UUID
  sku_interno: string
  gtin: string
  descricao: string
  marca: string
  unidade_compra: string
  /** DecimalField vem como string no DRF */
  fator_conversao: string
  is_active: boolean
}

// ─── Peça Canônica ────────────────────────────────────────────────────────────

export interface PecaCanonica {
  id: string
  codigo: string
  nome: string
  tipo_peca: 'genuina' | 'original' | 'paralela' | 'usada' | 'recondicionada'
  /** NCM 8 dígitos para NF-e de produto. Ex: "87089990". Vazio se não cadastrado. */
  ncm: string
  tem_embedding: boolean
  is_active: boolean
}

// ─── Fornecedor ───────────────────────────────────────────────────────────────

export interface Fornecedor {
  id: string
  pessoa: string              // UUID
  condicoes_pagamento: string
  prazo_entrega_dias: number | null
  avaliacao: number | null
  is_active: boolean
}

// ─── Alias de Serviço ─────────────────────────────────────────────────────────

export type AliasOrigem = 'import' | 'manual' | 'auto_alta' | 'auto_media'

export interface AliasServico {
  id: string
  canonico: string            // UUID do ServicoCanonico
  texto: string
  texto_normalizado: string
  origem: AliasOrigem
  confianca: number | null
  ocorrencias: number
  is_active: boolean
}

// ─── Match de Alias ───────────────────────────────────────────────────────────

export type AliasMetodo = 'exato' | 'fuzzy' | 'embedding'
export type AliasConfianca = 'alta' | 'media' | 'baixa'

export interface AliasMatch {
  canonico_id: string
  canonico_nome: string
  score: number
  metodo: AliasMetodo
  confianca: AliasConfianca
}
