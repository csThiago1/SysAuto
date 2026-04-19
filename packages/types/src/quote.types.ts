/**
 * @paddock/types — Quotes (Motor de Orçamentos MO-7)
 *
 * Tipos para orçamentos Cilia: Orcamento, AreaImpacto, OrcamentoIntervencao,
 * OrcamentoItemAdicional e payloads de criação/aprovação.
 */

// ── Vocabulário Cilia ──────────────────────────────────────────────────────────

export type Acao =
  | "trocar"
  | "reparar"
  | "pintar"
  | "remocao_instalacao";

export type StatusItem =
  | "orcado"
  | "aprovado"
  | "sem_cobertura"
  | "sob_analise"
  | "executado"
  | "cancelado";

export type QualificadorPeca = "PPO" | "PRO" | "PR" | "PREC";

export type Fornecimento = "oficina" | "seguradora" | "cliente";

export type StatusArea =
  | "aberta"
  | "aprovada"
  | "negada_pre_exist"
  | "parcial"
  | "cancelada";

export type StatusOrcamento =
  | "rascunho"
  | "enviado"
  | "aprovado"
  | "aprovado_parc"
  | "recusado"
  | "expirado"
  | "convertido_os";

export type TipoResponsabilidade = "cliente" | "seguradora" | "rcf";

// ── Modelos ────────────────────────────────────────────────────────────────────

export interface AreaImpacto {
  id: string;
  titulo: string;
  ordem: number;
  status: StatusArea;
  observacao_regulador: string;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoIntervencao {
  id: string;
  area_impacto: string;
  area_titulo: string;
  peca_canonica: string;
  peca_nome: string;
  acao: Acao;
  servico_canonico: string;
  servico_nome: string;
  ficha_tecnica: string | null;
  qualificador_peca: QualificadorPeca | "";
  fornecimento: Fornecimento;
  codigo_peca: string;
  quantidade: number;
  horas_mao_obra: string;
  valor_peca: string;
  valor_mao_obra: string;
  valor_insumos: string;
  preco_total: string;
  snapshot: string;
  status: StatusItem;
  abaixo_padrao: boolean;
  acima_padrao: boolean;
  inclusao_manual: boolean;
  codigo_diferente: boolean;
  ordem: number;
  descricao_visivel: string;
  observacao: string;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoItemAdicional {
  id: string;
  service_catalog: string;
  servico_nome: string;
  quantidade: number;
  preco_unitario: string;
  preco_total: string;
  snapshot: string;
  status: StatusItem;
  fornecimento: Fornecimento;
  inclusao_manual: boolean;
  abaixo_padrao: boolean;
  acima_padrao: boolean;
  ordem: number;
  descricao_visivel: string;
  observacao: string;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoList {
  id: string;
  numero: string;
  versao: number;
  status: StatusOrcamento;
  customer_nome: string;
  seguradora: string | null;
  veiculo_marca: string;
  veiculo_modelo: string;
  veiculo_ano: number;
  veiculo_placa: string;
  tipo_responsabilidade: TipoResponsabilidade;
  subtotal: string;
  desconto: string;
  total: string;
  validade: string;
  created_at: string;
}

export interface Orcamento extends OrcamentoList {
  empresa: string;
  customer: string;
  insurer: string | null;
  sinistro_numero: string;
  veiculo_versao: string;
  enquadramento_snapshot: {
    segmento_codigo: string;
    tamanho_codigo: string;
    fator_responsabilidade: string;
    tipo_pintura_codigo: string | null;
  };
  observacoes: string;
  enviado_em: string | null;
  aprovado_em: string | null;
  service_order: string | null;
  areas: AreaImpacto[];
  intervencoes: OrcamentoIntervencao[];
  itens_adicionais: OrcamentoItemAdicional[];
  updated_at: string;
}

// ── Payloads de entrada ───────────────────────────────────────────────────────

export interface VeiculoPayload {
  marca: string;
  modelo: string;
  ano: number;
  versao?: string;
  placa?: string;
  tipo_pintura_codigo?: string;
}

export interface OrcamentoCreatePayload {
  empresa_id: string;
  customer_id: string;
  insurer_id?: string | null;
  tipo_responsabilidade: TipoResponsabilidade;
  sinistro_numero?: string;
  veiculo: VeiculoPayload;
  observacoes?: string;
}

export interface AdicionarIntervencaoPayload {
  area_impacto_id: string;
  peca_canonica_id: string;
  acao: Acao;
  qualificador_peca?: QualificadorPeca;
  fornecimento?: Fornecimento;
  quantidade?: number;
  codigo_peca?: string;
  inclusao_manual?: boolean;
  descricao?: string;
}

export interface AdicionarItemAdicionalPayload {
  service_catalog_id: string;
  quantidade?: number;
  fornecimento?: Fornecimento;
  descricao?: string;
  inclusao_manual?: boolean;
}

export interface AprovarOrcamentoPayload {
  intervencoes_ids?: string[] | null;
  itens_adicionais_ids?: string[] | null;
  areas_negadas?: Array<{ area_id: string; motivo?: string }> | null;
}

export interface AprovarOrcamentoResponse {
  os_id: string;
  os_number: number;
}
