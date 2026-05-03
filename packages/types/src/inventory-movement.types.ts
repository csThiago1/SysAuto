/**
 * @paddock/types — WMS: Movimentação, Aprovação e Contagem
 * MovimentacaoEstoque, ContagemInventario, ItemContagem + inputs
 */

// ─── Movimentação ───────────────────────────────────────────────────────────

export type TipoMovimentacao =
  | "entrada_nf"
  | "entrada_manual"
  | "entrada_devolucao"
  | "saida_os"
  | "saida_perda"
  | "transferencia"
  | "ajuste_inventario"

export interface MovimentacaoEstoque {
  id: string
  tipo: TipoMovimentacao
  tipo_display: string
  unidade_fisica: string | null
  unidade_barcode: string
  lote_insumo: string | null
  lote_barcode: string
  quantidade: string
  nivel_origem: string | null
  nivel_origem_endereco: string
  nivel_destino: string | null
  nivel_destino_endereco: string
  ordem_servico: string | null
  nfe_entrada: string | null
  motivo: string
  evidencia: string | null
  aprovado_por: string | null
  aprovado_por_nome: string
  aprovado_em: string | null
  realizado_por: string
  realizado_por_nome: string
  created_at: string
}

// ─── Inputs de Movimentação ─────────────────────────────────────────────────

export interface EntradaPecaInput {
  peca_canonica_id: string
  valor_nf: string
  nivel_id: string
  motivo: string
  produto_peca_id?: string | null
  numero_serie?: string
}

export interface EntradaLoteInput {
  material_canonico_id: string
  quantidade_compra: string
  unidade_compra: string
  fator_conversao: string
  valor_total_nf: string
  nivel_id: string
  motivo: string
  produto_insumo_id?: string | null
  validade?: string | null
}

export interface TransferenciaInput {
  item_tipo: "unidade" | "lote"
  item_id: string
  nivel_destino_id: string
}

export interface PerdaInput {
  item_tipo: "unidade" | "lote"
  item_id: string
  motivo: string
  quantidade?: string | null
}

// ─── Contagem de Inventário ─────────────────────────────────────────────────

export type TipoContagem = "ciclica" | "total"
export type StatusContagem = "aberta" | "em_andamento" | "finalizada" | "cancelada"

export interface ContagemInventario {
  id: string
  tipo: TipoContagem
  tipo_display: string
  status: StatusContagem
  status_display: string
  armazem: string | null
  rua: string | null
  data_abertura: string
  data_fechamento: string | null
  iniciado_por: string
  iniciado_por_nome: string
  fechado_por: string | null
  fechado_por_nome: string
  observacoes: string
  total_itens: number
  total_contados: number
  total_divergencias: number
  created_at: string
}

export interface ItemContagem {
  id: string
  nivel: string
  nivel_endereco: string
  unidade_fisica: string | null
  unidade_barcode: string
  lote_insumo: string | null
  lote_barcode: string
  quantidade_sistema: string
  quantidade_contada: string | null
  divergencia: string
  contado_por: string | null
  contado_por_nome: string
  observacao: string
  created_at: string
}

export interface ContagemInventarioDetail extends ContagemInventario {
  itens: ItemContagem[]
}

// ─── Inputs de Contagem ─────────────────────────────────────────────────────

export interface AbrirContagemInput {
  tipo: TipoContagem
  armazem_id?: string | null
  rua_id?: string | null
}

export interface RegistrarItemInput {
  quantidade_contada: string
  observacao?: string
}
