/**
 * @paddock/types — WMS: Produto Comercial (Peças e Insumos SEPARADOS)
 * TipoPeca, CategoriaProduto, CategoriaInsumo, ProdutoComercialPeca, ProdutoComercialInsumo
 */

export interface TipoPeca {
  id: string
  nome: string
  codigo: string
  ordem: number
  is_active: boolean
  created_at: string
}

export interface CategoriaProduto {
  id: string
  nome: string
  codigo: string
  margem_padrao_pct: string
  ordem: number
  is_active: boolean
  created_at: string
}

export interface CategoriaInsumo {
  id: string
  nome: string
  codigo: string
  margem_padrao_pct: string
  ordem: number
  is_active: boolean
  created_at: string
}

export type PosicaoVeiculo =
  | "dianteiro"
  | "traseiro"
  | "lateral_esq"
  | "lateral_dir"
  | "superior"
  | "inferior"
  | "na"

export type LadoPeca = "esquerdo" | "direito" | "central" | "na"

export interface ProdutoComercialPeca {
  id: string
  sku_interno: string
  nome_interno: string
  codigo_fabricante: string
  codigo_ean: string
  codigo_distribuidor: string
  nome_fabricante: string
  tipo_peca: string | null
  tipo_peca_nome: string
  posicao_veiculo: PosicaoVeiculo
  posicao_veiculo_display: string
  lado: LadoPeca
  lado_display: string
  categoria: string | null
  categoria_nome: string
  peca_canonica: string | null
  preco_venda_sugerido: string | null
  margem_padrao_pct: string | null
  observacoes: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProdutoComercialInsumo {
  id: string
  sku_interno: string
  nome_interno: string
  codigo_fabricante: string
  codigo_ean: string
  nome_fabricante: string
  unidade_base: string
  categoria_insumo: string | null
  categoria_insumo_nome: string
  material_canonico: string | null
  preco_venda_sugerido: string | null
  margem_padrao_pct: string | null
  observacoes: string
  is_active: boolean
  created_at: string
  updated_at: string
}
