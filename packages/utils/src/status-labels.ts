/**
 * @paddock/utils — Status Labels
 * Labels, badges e cores para status de documentos financeiros e fiscais.
 * Centralizado aqui para evitar duplicacao entre paginas.
 */

// ─── Fiscal ──────────────────────────────────────────────────────────────────

export const FISCAL_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  authorized: "Autorizada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};

export const FISCAL_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 border border-amber-200",
  authorized: "bg-success-100 text-success-700 border border-success-200",
  rejected: "bg-error-100 text-error-700 border border-error-200",
  cancelled: "bg-neutral-100 text-neutral-500 border border-neutral-200",
};

// ─── NF-e Entrada ────────────────────────────────────────────────────────────

export const NFE_ENTRADA_STATUS_LABEL: Record<string, string> = {
  importada: "Importada",
  validada: "Validada",
  estoque_gerado: "Estoque Gerado",
};

export const NFE_ENTRADA_STATUS_BADGE: Record<string, string> = {
  importada: "bg-blue-100 text-blue-700 border border-blue-200",
  validada: "bg-amber-100 text-amber-700 border border-amber-200",
  estoque_gerado: "bg-success-100 text-success-700 border border-success-200",
};

// ─── Contagem de Estoque ─────────────────────────────────────────────────────

export const CONTAGEM_STATUS_LABEL: Record<string, string> = {
  aberta: "ABERTA",
  em_andamento: "EM ANDAMENTO",
  finalizada: "FINALIZADA",
  cancelada: "CANCELADA",
};

export const CONTAGEM_STATUS_BADGE: Record<string, string> = {
  aberta: "bg-info-500/10 text-info-400 border border-info-500/20",
  em_andamento: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
  finalizada: "bg-success-500/10 text-success-400 border border-success-500/20",
  cancelada: "bg-muted/50 text-muted-foreground border border-border",
};

export const CONTAGEM_TIPO_LABEL: Record<string, string> = {
  ciclica: "CÍCLICA",
  total: "TOTAL",
};

export const CONTAGEM_TIPO_BADGE: Record<string, string> = {
  ciclica: "bg-info-500/10 text-info-400 border border-info-500/20",
  total: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
};

// ─── Orcamentos ──────────────────────────────────────────────────────────────

export const ORCAMENTO_STATUS_LABEL: Record<string, string> = {
  rascunho:      "Rascunho",
  enviado:       "Enviado",
  aprovado:      "Aprovado",
  aprovado_parc: "Aprovado Parcial",
  recusado:      "Recusado",
  expirado:      "Expirado",
  convertido_os: "Convertido em OS",
};

export const ORCAMENTO_STATUS_BADGE: Record<string, string> = {
  rascunho:      "text-muted-foreground bg-muted",
  enviado:       "text-info-400 bg-info-400/10",
  aprovado:      "text-success-400 bg-success-400/10",
  aprovado_parc: "text-warning-400 bg-warning-400/10",
  recusado:      "text-error-400 bg-error-400/10",
  expirado:      "text-warning-400 bg-warning-400/10",
  convertido_os: "text-foreground/60 bg-muted",
};

// ─── Budget Versions ─────────────────────────────────────────────────────────

export const BUDGET_VERSION_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

export const BUDGET_VERSION_STATUS_BADGE: Record<string, string> = {
  rascunho: "bg-neutral-100 text-neutral-600 border border-neutral-200",
  pendente: "bg-amber-100 text-amber-700 border border-amber-200",
  aprovada: "bg-success-100 text-success-700 border border-success-200",
  rejeitada: "bg-error-100 text-error-700 border border-error-200",
};

// ─── Unidade Fisica ──────────────────────────────────────────────────────────

export const UNIDADE_FISICA_STATUS_LABEL: Record<string, string> = {
  available: "Disponivel",
  reserved: "Reservada",
  consumed: "Consumida",
  returned: "Devolvida",
};

export const UNIDADE_FISICA_STATUS_BADGE: Record<string, string> = {
  available: "bg-success-100 text-success-700 border border-success-200",
  reserved: "bg-amber-100 text-amber-700 border border-amber-200",
  consumed: "bg-neutral-100 text-neutral-500 border border-neutral-200",
  returned: "bg-blue-100 text-blue-700 border border-blue-200",
};

// ─── Benchmark Ingestao ──────────────────────────────────────────────────────

export const BENCHMARK_INGESTAO_STATUS_LABEL: Record<string, string> = {
  recebido:    "Recebido",
  processando: "Processando...",
  concluido:   "Concluído",
  erro:        "Erro",
};

export const BENCHMARK_INGESTAO_STATUS_BADGE: Record<string, string> = {
  recebido:    "border-border text-muted-foreground bg-muted/50",
  processando: "border-blue-500/30 text-blue-400 bg-blue-400/10",
  concluido:   "border-success-500/30 text-success-400 bg-success-400/10",
  erro:        "border-error-500/30 text-error-400 bg-red-400/10",
};
