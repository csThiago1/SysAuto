/**
 * Paddock Solutions — Capacidade Técnica Types
 * MO-9: Capacidade produtiva, bloqueios e utilização.
 */

export interface CapacidadeTecnico {
  id: string
  tecnico: string // Employee UUID
  categoria_mao_obra: string // CategoriaMaoObra UUID
  horas_dia_util: string // Decimal string
  dias_semana: number[] // ISO weekdays 1=seg…7=dom
  vigente_desde: string // YYYY-MM-DD
  vigente_ate: string | null
}

export interface BloqueioCapacidade {
  id: string
  tecnico: string
  data_inicio: string
  data_fim: string
  motivo: string
  is_active: boolean
}

export interface UtilizacaoCapacidade {
  categoria_mao_obra_id: string
  periodo_inicio: string
  periodo_fim: string
  horas_disponiveis: number
  horas_comprometidas: number
  utilizacao: number // 0–1
  tecnicos: string[]
}

export interface HeatmapDiaCategoria {
  categoria_id: string
  utilizacao: number
}

export interface HeatmapDia {
  data: string
  categorias: HeatmapDiaCategoria[]
  utilizacao_geral: number
}

export interface ProximaDataDisponivel {
  proxima_data: string | null
}

// ── Variâncias ────────────────────────────────────────────────────────────────

export interface VarianciaFicha {
  id: string
  servico_canonico_id: string
  mes_referencia: string // YYYY-MM-DD (primeiro dia)
  qtd_os: number
  horas_estimadas_total: string
  horas_realizadas_total: string
  variancia_horas_pct: string
  custo_insumo_estimado: string
  custo_insumo_realizado: string
  variancia_insumo_pct: string
  created_at: string
}

export interface VarianciaPecaCusto {
  id: string
  peca_canonica_id: string
  mes_referencia: string
  qtd_amostras: number
  custo_snapshot_medio: string
  custo_nfe_medio: string
  variancia_pct: string
  alerta: boolean
  created_at: string
}

// ── Auditoria Motor ───────────────────────────────────────────────────────────

export type AuditoriaOperacao =
  | "calcular_servico"
  | "calcular_peca"
  | "simular"
  | "benchmark_check"

export interface AuditoriaMotor {
  id: string
  operacao: AuditoriaOperacao
  chamado_por: string | null
  empresa_id: string | null
  contexto_input: Record<string, unknown>
  resultado_output: Record<string, unknown> | null
  sucesso: boolean
  erro_msg: string
  tempo_ms: number
  snapshot_id: string | null
  created_at: string
}

export interface MotorHealthcheck {
  status: "ok" | "error"
  total_chamadas?: number
  taxa_erro_pct?: number
  tempo_medio_ms?: number
  detalhe?: string
}
