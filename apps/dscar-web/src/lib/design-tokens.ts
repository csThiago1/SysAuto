/**
 * DS Car Design Tokens — Camada semântica sobre o Tailwind config
 *
 * Este arquivo mapeia entidades de negócio (ServiceOrderStatus, PaddockRole)
 * para classes Tailwind. Importe aqui, não hardcode cores em componentes.
 */

import type { ServiceOrderStatus, PaddockRole } from "@paddock/types";

// ─── Status de OS → Cores ────────────────────────────────────────────────────
//
// Lógica de agrupamento:
//   AZUL (info)     → fases administrativas / entrada
//   ÂMBAR (warning) → fases em espera / pendente
//   VERMELHO (primary) → fases de trabalho ativo / urgência
//   ROXO            → fases especializadas (lataria, pintura)
//   VERDE (success) → fases de saída / conclusão
//   CINZA (neutral) → cancelado / arquivado
//
export const SERVICE_ORDER_STATUS_CONFIG: Record<
  ServiceOrderStatus,
  {
    label: string;
    // Classes para o badge (pill)
    badge: string;
    // Classe de borda para o card no kanban
    border: string;
    // Cor do header da coluna kanban
    column: string;
    // Dot indicador de cor sólida
    dot: string;
  }
> = {
  // ── Fases Administrativas (azul info) ──────────────────────────────────────
  reception: {
    label: "Recepção",
    badge:  "bg-info-100 text-info-800 border border-info-200",
    border: "border-l-4 border-l-info-400",
    column: "bg-info-600",
    dot:    "bg-info-500",
  },
  initial_survey: {
    label: "Vistoria Inicial",
    badge:  "bg-info-100 text-info-800 border border-info-200",
    border: "border-l-4 border-l-info-500",
    column: "bg-info-700",
    dot:    "bg-info-600",
  },
  budget: {
    label: "Orçamento",
    badge:  "bg-info-50 text-info-700 border border-info-200",
    border: "border-l-4 border-l-info-300",
    column: "bg-info-500",
    dot:    "bg-info-400",
  },

  // ── Fases de Espera (âmbar warning) ──────────────────────────────────────
  waiting_parts: {
    label: "Aguardando Peças",
    badge:  "bg-warning-100 text-warning-800 border border-warning-200",
    border: "border-l-4 border-l-warning-400",
    column: "bg-warning-600",
    dot:    "bg-warning-500",
  },

  // ── Fases de Trabalho Ativo (vermelho primary) ────────────────────────────
  repair: {
    label: "Em Reparo",
    badge:  "bg-primary-100 text-primary-800 border border-primary-200",
    border: "border-l-4 border-l-primary-500",
    column: "bg-primary-700",
    dot:    "bg-primary-500",
  },
  mechanic: {
    label: "Mecânica",
    badge:  "bg-primary-50 text-primary-700 border border-primary-200",
    border: "border-l-4 border-l-primary-400",
    column: "bg-primary-600",
    dot:    "bg-primary-400",
  },

  // ── Fases Especializadas (roxo — cor distinta para diferenciação visual) ──
  bodywork: {
    label: "Funilaria",
    badge:  "bg-purple-100 text-purple-800 border border-purple-200",
    border: "border-l-4 border-l-purple-500",
    column: "bg-purple-700",
    dot:    "bg-purple-500",
  },
  painting: {
    label: "Pintura",
    badge:  "bg-purple-50 text-purple-700 border border-purple-200",
    border: "border-l-4 border-l-purple-400",
    column: "bg-purple-600",
    dot:    "bg-purple-400",
  },
  assembly: {
    label: "Montagem",
    badge:  "bg-primary-100 text-primary-800 border border-primary-200",
    border: "border-l-4 border-l-primary-600",
    column: "bg-primary-800",
    dot:    "bg-primary-600",
  },

  // ── Fases de Acabamento (âmbar claro) ─────────────────────────────────────
  polishing: {
    label: "Polimento",
    badge:  "bg-warning-50 text-warning-700 border border-warning-200",
    border: "border-l-4 border-l-warning-300",
    column: "bg-warning-500",
    dot:    "bg-warning-400",
  },
  washing: {
    label: "Lavagem",
    badge:  "bg-accent-100 text-accent-700 border border-accent-200",
    border: "border-l-4 border-l-accent-400",
    column: "bg-accent-500",
    dot:    "bg-accent-400",
  },

  // ── Fases de Saída / Conclusão (verde success) ────────────────────────────
  final_survey: {
    label: "Vistoria Final",
    badge:  "bg-success-100 text-success-800 border border-success-200",
    border: "border-l-4 border-l-success-400",
    column: "bg-success-600",
    dot:    "bg-success-500",
  },
  ready: {
    label: "Pronto p/ Entrega",
    badge:  "bg-success-100 text-success-700 border border-success-200",
    border: "border-l-4 border-l-success-500",
    column: "bg-success-600",
    dot:    "bg-success-500",
  },
  delivered: {
    label: "Entregue",
    badge:  "bg-success-50 text-success-600 border border-success-100",
    border: "border-l-4 border-l-success-300",
    column: "bg-success-700",
    dot:    "bg-success-400",
  },

  // ── Cancelado (neutro) ────────────────────────────────────────────────────
  cancelled: {
    label: "Cancelado",
    badge:  "bg-neutral-100 text-neutral-500 border border-neutral-200",
    border: "border-l-4 border-l-neutral-300",
    column: "bg-neutral-500",
    dot:    "bg-neutral-400",
  },
} as const;

// ─── Role → Label ────────────────────────────────────────────────────────────
export const ROLE_LABEL: Record<PaddockRole, string> = {
  OWNER:       "Proprietário",
  ADMIN:       "Administrador",
  MANAGER:     "Gerente",
  CONSULTANT:  "Consultor",
  STOREKEEPER: "Almoxarife",
} as const;

// ─── Urgência IA → Cores ─────────────────────────────────────────────────────
export const URGENCY_CONFIG = {
  critical: {
    label: "Crítico",
    badge: "bg-error-100 text-error-800 border border-error-200",
    dot:   "bg-error-500",
    icon:  "animate-pulse-red",
  },
  high: {
    label: "Alto",
    badge: "bg-primary-100 text-primary-800 border border-primary-200",
    dot:   "bg-primary-500",
    icon:  "",
  },
  medium: {
    label: "Médio",
    badge: "bg-warning-100 text-warning-800 border border-warning-200",
    dot:   "bg-warning-500",
    icon:  "",
  },
  low: {
    label: "Baixo",
    badge: "bg-success-100 text-success-800 border border-success-200",
    dot:   "bg-success-500",
    icon:  "",
  },
} as const;

// ─── Kanban — ordem e agrupamento das colunas ─────────────────────────────────
//
// O kanban do DS Car usa agrupamento por fase. Colunas que fazem sentido
// estarem próximas são agrupadas em "swimlanes" opcionais.
//
export const KANBAN_COLUMNS_ORDER: ServiceOrderStatus[] = [
  "reception",
  "initial_survey",
  "budget",
  "waiting_parts",
  "repair",
  "mechanic",
  "bodywork",
  "painting",
  "assembly",
  "polishing",
  "washing",
  "final_survey",
  "ready",
  "delivered",
];

// Colunas do kanban que não aparecem no board padrão (filtradas por default)
export const KANBAN_HIDDEN_BY_DEFAULT: ServiceOrderStatus[] = [
  "delivered",
  "cancelled",
];
