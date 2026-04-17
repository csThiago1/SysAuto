/**
 * @paddock/types — Motor de Orçamentos (MO-3: Adapters de Custo)
 * Tipos para parâmetros de custo/hora, rateio e endpoints de debug.
 */

// ─── Parâmetro de Rateio ──────────────────────────────────────────────────────

export interface ParametroRateio {
  id: string;
  empresa: string;
  vigente_desde: string;
  vigente_ate: string | null;
  /** DecimalField vem como string no DRF */
  horas_produtivas_mes: string;
  metodo: "por_hora" | "por_os";
  observacoes: string;
  is_active: boolean;
}

export interface ParametroRateioCreate {
  empresa: string;
  vigente_desde: string;
  vigente_ate: string | null;
  horas_produtivas_mes: string;
  metodo: "por_hora" | "por_os";
  observacoes?: string;
}

// ─── Parâmetro de Custo Hora ──────────────────────────────────────────────────

export interface ParametroCustoHora {
  id: string;
  empresa: string;
  vigente_desde: string;
  vigente_ate: string | null;
  /** Fração do bruto — ex: "0.1389" = 13,89% */
  provisao_13_ferias: string;
  /** Fração do bruto — ex: "0.0320" = 3,20% */
  multa_fgts_rescisao: string;
  /** Valor fixo em R$ por funcionário/mês */
  beneficios_por_funcionario: string;
  /** Horas produtivas individuais por mês */
  horas_produtivas_mes: string;
  observacoes: string;
  is_active: boolean;
}

export interface ParametroCustoHoraCreate {
  empresa: string;
  vigente_desde: string;
  vigente_ate: string | null;
  provisao_13_ferias: string;
  multa_fgts_rescisao: string;
  beneficios_por_funcionario: string;
  horas_produtivas_mes: string;
  observacoes?: string;
}

// ─── Custo Hora Fallback ──────────────────────────────────────────────────────

export interface CustoHoraFallback {
  id: string;
  empresa: string;
  /** UUID da CategoriaMaoObra */
  categoria: string;
  /** Nome da categoria — SerializerMethodField */
  categoria_nome?: string;
  vigente_desde: string;
  vigente_ate: string | null;
  /** Valor em R$/h como string */
  valor_hora: string;
  motivo: string;
  is_active: boolean;
}

export interface CustoHoraFallbackCreate {
  empresa: string;
  categoria: string;
  vigente_desde: string;
  vigente_ate: string | null;
  valor_hora: string;
  motivo?: string;
}

// ─── Debug Endpoints ──────────────────────────────────────────────────────────

export interface DebugCustoHoraInput {
  categoria_codigo: string;
  data: string;
  empresa_id: string;
}

export interface DebugRateioInput {
  data: string;
  empresa_id: string;
}

export interface CustoHoraResult {
  valor: string;
  origem: "rh" | "fallback";
  decomposicao: Record<string, unknown>;
  calculado_em: string;
}

export interface RateioResult {
  rateio_hora: string;
  total_despesas: string;
  decomposicao_despesas: Array<{
    id: string;
    tipo: string;
    descricao: string;
    valor_mensal: string;
  }>;
  calculado_em: string;
}
