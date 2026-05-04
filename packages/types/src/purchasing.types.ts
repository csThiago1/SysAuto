/**
 * @paddock/types — Purchasing (Compras)
 * PedidoCompra, OrdemCompra, ItemOrdemCompra
 * Espelha os models do backend purchasing/. Manter em sincronia.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────────

export type TipoQualidade = "genuina" | "reposicao" | "similar" | "usada"
export type OrigemPeca = "estoque" | "compra" | "seguradora" | "manual"
export type StatusPeca =
  | "bloqueada"
  | "aguardando_cotacao"
  | "em_cotacao"
  | "aguardando_aprovacao"
  | "comprada"
  | "recebida"
  | "aguardando_seguradora"
  | "manual"

export type StatusPedidoCompra =
  | "solicitado"
  | "em_cotacao"
  | "oc_pendente"
  | "aprovado"
  | "comprado"
  | "recebido"
  | "cancelado"

export type StatusOrdemCompra =
  | "rascunho"
  | "pendente_aprovacao"
  | "aprovada"
  | "rejeitada"
  | "parcial_recebida"
  | "concluida"

// ─── Entidades ──────────────────────────────────────────────────────────────────

export interface PedidoCompra {
  id: string
  service_order: string
  service_order_part: string
  descricao: string
  codigo_referencia: string
  tipo_qualidade: TipoQualidade
  tipo_qualidade_display: string
  quantidade: string
  valor_cobrado_cliente: string
  observacoes: string
  status: StatusPedidoCompra
  status_display: string
  solicitado_por: string
  solicitado_por_nome: string
  os_number: number | null
  veiculo: string
  created_at: string
}

export interface ItemOrdemCompra {
  id: string
  ordem_compra: string
  pedido_compra: string | null
  fornecedor: string | null
  fornecedor_nome: string
  fornecedor_cnpj: string
  fornecedor_contato: string
  descricao: string
  codigo_referencia: string
  tipo_qualidade: TipoQualidade
  tipo_qualidade_display: string
  quantidade: string
  valor_unitario: string
  valor_total: string
  prazo_entrega: string
  observacoes: string
  created_at: string
}

export interface OrdemCompra {
  id: string
  numero: string
  service_order: string
  os_number: number | null
  status: StatusOrdemCompra
  status_display: string
  valor_total: string
  criado_por: string
  criado_por_nome: string
  aprovado_por_nome: string
  total_itens: number
  created_at: string
}

export interface OrdemCompraDetail extends OrdemCompra {
  itens: ItemOrdemCompra[]
  observacoes: string
  aprovado_em: string | null
  rejeitado_por: string | null
  motivo_rejeicao: string
}

export interface DashboardComprasStats {
  solicitados: number
  em_cotacao: number
  aguardando_aprovacao: number
  aprovadas_hoje: number
}

// ─── Inputs ─────────────────────────────────────────────────────────────────────

export interface AdicionarItemOCInput {
  pedido_compra_id?: string | null
  fornecedor_id?: string | null
  fornecedor_nome: string
  fornecedor_cnpj?: string
  fornecedor_contato?: string
  descricao: string
  codigo_referencia?: string
  tipo_qualidade: TipoQualidade
  quantidade: string
  valor_unitario: string
  prazo_entrega?: string
  observacoes?: string
}

export interface PartEstoqueInput {
  unidade_fisica_id: string
  tipo_qualidade: TipoQualidade
  unit_price: string
  description?: string
}

export interface PartCompraInput {
  description: string
  part_number?: string
  tipo_qualidade: TipoQualidade
  unit_price: string
  quantity?: string
  observacoes?: string
}

export interface PartSeguradoraInput {
  description: string
  tipo_qualidade: TipoQualidade
  unit_price: string
  quantity?: string
}

// ─── Busca Pecas ────────────────────────────────────────────────────────────────

export interface PecaEstoqueResult {
  id: string
  sku_interno: string
  nome_interno: string
  codigo_fabricante: string
  tipo_peca_nome: string
  categoria_nome: string
  posicao_veiculo: string
  lado: string
  estoque_disponivel: number
  posicao: string
  preco_venda_sugerido: string | null
}
