/**
 * Paddock Solutions — Pricing Engine Types
 * Motor de Orçamentos (MO) — Sprint MO-6
 *
 * Tipos para motor de precificação: cálculo de serviços, peças,
 * margens, snapshots imutáveis e simulador.
 */

// ─── Contexto de cálculo ────────────────────────────────────────────────────

export interface ContextoCalculoInput {
  empresa_id: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_ano: number
  veiculo_versao?: string | null
  tipo_pintura_codigo?: string | null
  quem_paga?: "cliente" | "seguradora"
  aplica_multiplicador_tamanho?: boolean
}

// ─── Inputs de cálculo ──────────────────────────────────────────────────────

export interface CalcularServicoInput {
  contexto: ContextoCalculoInput
  servico_canonico_id: string
  origem?: "orcamento_linha" | "os_linha" | "simulacao"
}

export interface CalcularPecaInput {
  contexto: ContextoCalculoInput
  peca_canonica_id: string
  quantidade?: number
  origem?: "orcamento_linha" | "os_linha" | "simulacao"
}

export interface SimularItemInput {
  tipo: "servico" | "peca"
  id: string
  quantidade?: number
}

export interface SimularInput {
  contexto: ContextoCalculoInput
  itens: SimularItemInput[]
}

// ─── Resultados de cálculo ──────────────────────────────────────────────────

export interface ResultadoServicoDTO {
  snapshot_id: string
  preco_final: string // Decimal serializado como string
  custo_total_base: string
  margem_ajustada: string
  teto_aplicado: boolean
  decomposicao: Record<string, unknown>
}

export interface ResultadoPecaDTO {
  snapshot_id: string
  preco_final: string
  custo_base: string
  margem_ajustada: string
  decomposicao: Record<string, unknown>
}

export interface SimularResultadoOK {
  ok: true
  tipo: "servico" | "peca"
  id: string
  resultado: ResultadoServicoDTO | ResultadoPecaDTO
}

export interface SimularResultadoErro {
  ok: false
  tipo: "servico" | "peca"
  id: string
  erro: string
  recurso_faltante: string | null
}

export type SimularResultadoItem = SimularResultadoOK | SimularResultadoErro

export interface SimularResponse {
  resultados: SimularResultadoItem[]
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

/** CONSULTANT+: apenas preco_final e contexto */
export interface SnapshotMin {
  id: string
  origem: "orcamento_linha" | "os_linha" | "simulacao"
  calculado_em: string
  contexto: Record<string, unknown>
  preco_final: string
  is_active: boolean
  empresa: string
  servico_canonico: string | null
  peca_canonica: string | null
}

/** MANAGER+: inclui custo, margem e decomposição */
export interface SnapshotMgr extends SnapshotMin {
  custo_total_base: string
  fator_responsabilidade: string
  margem_base: string
  margem_ajustada: string
  preco_calculado: string
  preco_teto_benchmark: string | null
  decomposicao: Record<string, unknown>
  calculado_por: string | null
}

/** ADMIN+: inclui breakdown de custo completo */
export interface SnapshotFull extends SnapshotMgr {
  custo_mo: string
  custo_insumos: string
  rateio: string
  custo_peca_base: string
}

export type Snapshot = SnapshotMin | SnapshotMgr | SnapshotFull

// ─── Margens ─────────────────────────────────────────────────────────────────

export type TipoOperacao = "servico_mao_obra" | "peca_revenda" | "insumo_comp"

export interface MargemOperacao {
  id: string
  empresa: string
  segmento: string
  segmento_nome?: string
  tipo_operacao: TipoOperacao
  tipo_operacao_display?: string
  margem_percentual: string // "0.4000" = 40%
  vigente_desde: string // YYYY-MM-DD
  vigente_ate: string | null
  is_active: boolean
}

export interface MargemOperacaoCreate {
  empresa: string
  segmento: string
  tipo_operacao: TipoOperacao
  margem_percentual: string
  vigente_desde: string
  vigente_ate?: string | null
}

// ─── Markup por peça ─────────────────────────────────────────────────────────

export interface MarkupPeca {
  id: string
  empresa: string
  peca_canonica: string | null
  peca_canonica_nome?: string | null
  faixa_custo_min: string | null
  faixa_custo_max: string | null
  margem_percentual: string // "0.3500" = 35%
  vigente_desde: string
  vigente_ate: string | null
  is_active: boolean
}

export interface MarkupPecaCreate {
  empresa: string
  peca_canonica?: string | null
  faixa_custo_min?: string | null
  faixa_custo_max?: string | null
  margem_percentual: string
  vigente_desde: string
  vigente_ate?: string | null
}
