/**
 * @paddock/types — Motor de Orçamentos (MO-5: Estoque Físico + NF-e Entrada)
 * Tipos para UnidadeFisica, LoteInsumo, ImpressoraEtiqueta e NFeEntrada.
 */

// ─── Unidade Física (Peça) ────────────────────────────────────────────────────

export type UnidadeFisicaStatus = 'available' | 'reserved' | 'consumed' | 'returned' | 'lost'

export interface UnidadeFisica {
  id: string
  codigo_barras: string
  peca_canonica_id: string
  peca_nome: string
  status: UnidadeFisicaStatus
  localizacao: string
  numero_serie: string
  ordem_servico_id: string | null
  consumida_em: string | null
  created_at: string
}

export interface UnidadeFisicaDetail extends UnidadeFisica {
  codigo_fornecedor_id: string | null
  nfe_entrada_id: string | null
  nfe_numero: string | null
  valor_nf: string  // Decimal — string para evitar float
  updated_at: string
}

export interface ReservaInput {
  ordem_servico_id: string
  forcar_mais_caro?: boolean
  justificativa?: string
}

export interface BipagemInput {
  codigo_barras: string
  ordem_servico_id: string
}

// ─── Lote de Insumo ───────────────────────────────────────────────────────────

export interface LoteInsumo {
  id: string
  codigo_barras: string
  material_canonico_id: string
  material_nome: string
  unidade_base: string
  saldo: string          // Decimal
  quantidade_base: string
  saldo_percentual: number
  unidade_compra: string
  valor_unitario_base: string
  validade: string | null
  localizacao: string
  nfe_entrada_id: string | null
  created_at: string
}

export interface BaixaInsumoInput {
  material_canonico_id: string
  quantidade_base: string
  ordem_servico_id: string
}

// ─── Impressora de Etiqueta ───────────────────────────────────────────────────

export type ModeloImpressora = 'zebra_zpl' | 'bixolon_spp' | 'brother_ql'

export interface ImpressoraEtiqueta {
  id: string
  nome: string
  modelo: ModeloImpressora
  modelo_display: string
  endpoint: string
  largura_mm: number
  altura_mm: number
  is_active: boolean
}

// ─── NF-e de Entrada ─────────────────────────────────────────────────────────

export type NFeEntradaStatus = 'importada' | 'validada' | 'estoque_gerado'
export type StatusReconciliacao = 'pendente' | 'peca' | 'insumo' | 'ignorado'

export interface NFeEntradaItem {
  id: string
  numero_item: number
  descricao_original: string
  codigo_produto_nf: string
  ncm: string
  unidade_compra: string
  quantidade: string
  valor_unitario_bruto: string
  valor_unitario_com_tributos: string
  valor_total_com_tributos: string
  fator_conversao: string
  peca_canonica_id: string | null
  peca_nome: string | null
  material_canonico_id: string | null
  material_nome: string | null
  codigo_fornecedor_id: string | null
  status_reconciliacao: StatusReconciliacao
}

export interface NFeEntrada {
  id: string
  chave_acesso: string
  numero: string
  serie: string
  emitente_cnpj: string
  emitente_nome: string
  data_emissao: string | null
  valor_total: string
  status: NFeEntradaStatus
  estoque_gerado: boolean
  total_itens: number
  created_at: string
}

export interface NFeEntradaDetail extends NFeEntrada {
  xml_s3_key: string
  observacoes: string
  itens: NFeEntradaItem[]
  updated_at: string
}

export interface NFeEntradaCreateInput {
  chave_acesso?: string
  numero: string
  serie?: string
  emitente_cnpj?: string
  emitente_nome: string
  data_emissao?: string
  valor_total: string
  observacoes?: string
}

export interface ReconciliarItemInput {
  status_reconciliacao: StatusReconciliacao
  peca_canonica_id?: string | null
  material_canonico_id?: string | null
  codigo_fornecedor_id?: string | null
}

export interface GerarEstoqueResult {
  unidades_criadas: number
  lotes_criados: number
  pendentes_reconciliacao: number
}
