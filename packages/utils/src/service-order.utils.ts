/**
 * @paddock/utils — Service Order utilities
 * Config de status, pastas de fotos, grupos do Kanban e helpers de OS.
 */

import type { ServiceOrderStatus, PaddockRole, OSPhotoFolder } from "@paddock/types";

// ─── Config de status ────────────────────────────────────────────────────────

export interface StatusConfig {
  label: string;
  /** Classes do badge pill */
  badge: string;
  /** Borda colorida para o card no kanban */
  border: string;
  /** Cor do header da coluna Kanban */
  column: string;
  /** Ponto colorido sólido */
  dot: string;
  /** Cor de texto pura (sem bg) — legível em fundo escuro, pro card de lista denso */
  text: string;
}

/** Etiqueta em faixa inclinada (Box de corrida). Vence o `rounded-full` dos call sites. */
const FAIXA = "rounded-none [clip-path:polygon(4px_0,100%_0,calc(100%-4px)_100%,0_100%)]";

// Cores das bandeiras do manual da marca: cinza = administrativo, amarelo =
// esperando alguém, azul = carro em trabalho, verde = pronto.
export const SERVICE_ORDER_STATUS_CONFIG: Record<ServiceOrderStatus, StatusConfig> = {
  // ── Fases Administrativas (cinza) ─────────────────────────────────────────
  reception: {
    label:  "Recepção",
    badge:  `bg-flag-grafite text-flag-gelo ${FAIXA}`,
    border: "border-l-4 border-l-flag-aluminio",
    column: "bg-flag-grafite text-flag-gelo",
    dot:    "bg-flag-aluminio",
    text:   "text-muted-foreground",
  },
  initial_survey: {
    label:  "Vistoria Inicial",
    badge:  `bg-flag-grafite text-flag-gelo ${FAIXA}`,
    border: "border-l-4 border-l-flag-aluminio",
    column: "bg-flag-grafite text-flag-gelo",
    dot:    "bg-flag-aluminio",
    text:   "text-muted-foreground",
  },
  budget: {
    label:  "Orçamento",
    badge:  `bg-flag-grafite text-flag-gelo ${FAIXA}`,
    border: "border-l-4 border-l-flag-aluminio",
    column: "bg-flag-grafite text-flag-gelo",
    dot:    "bg-flag-aluminio",
    text:   "text-muted-foreground",
  },

  // ── Fases de Autorização ──────────────────────────────────────────────────
  waiting_auth: {
    label:  "Aguard. Autorização",
    badge:  `bg-flag-amarela text-black ${FAIXA}`,
    border: "border-l-4 border-l-flag-amarela",
    column: "bg-flag-amarela text-black",
    dot:    "bg-flag-amarela",
    text:   "text-warning-400",
  },
  authorized: {
    label:  "Autorizada",
    badge:  `bg-flag-grafite text-flag-gelo ${FAIXA}`,
    border: "border-l-4 border-l-flag-aluminio",
    column: "bg-flag-grafite text-flag-gelo",
    dot:    "bg-flag-aluminio",
    text:   "text-muted-foreground",
  },

  // ── Aguardando Peças ──────────────────────────────────────────────────────
  waiting_parts: {
    label:  "Aguardando Peças",
    badge:  `bg-flag-amarela text-black ${FAIXA}`,
    border: "border-l-4 border-l-flag-amarela",
    column: "bg-flag-amarela text-black",
    dot:    "bg-flag-amarela",
    text:   "text-warning-400",
  },

  // ── Trabalho Ativo (vermelho/laranja) ─────────────────────────────────────
  repair: {
    label:  "Em Reparo",
    badge:  `bg-flag-azul text-white ${FAIXA}`,
    border: "border-l-4 border-l-flag-azul",
    column: "bg-flag-azul text-white",
    dot:    "bg-flag-azul",
    text:   "text-info-400",
  },
  mechanic: {
    label:  "Mecânica",
    badge:  `bg-flag-azul text-white ${FAIXA}`,
    border: "border-l-4 border-l-flag-azul",
    column: "bg-flag-azul text-white",
    dot:    "bg-flag-azul",
    text:   "text-info-400",
  },

  // ── Especializado (roxo) ──────────────────────────────────────────────────
  bodywork: {
    label:  "Funilaria",
    badge:  `bg-flag-azul text-white ${FAIXA}`,
    border: "border-l-4 border-l-flag-azul",
    column: "bg-flag-azul text-white",
    dot:    "bg-flag-azul",
    text:   "text-info-400",
  },
  painting: {
    label:  "Pintura",
    badge:  `bg-flag-azul text-white ${FAIXA}`,
    border: "border-l-4 border-l-flag-azul",
    column: "bg-flag-azul text-white",
    dot:    "bg-flag-azul",
    text:   "text-info-400",
  },
  assembly: {
    label:  "Montagem",
    badge:  `bg-flag-azul text-white ${FAIXA}`,
    border: "border-l-4 border-l-flag-azul",
    column: "bg-flag-azul text-white",
    dot:    "bg-flag-azul",
    text:   "text-info-400",
  },

  // ── Acabamento ────────────────────────────────────────────────────────────
  polishing: {
    label:  "Polimento",
    badge:  `bg-flag-azul text-white ${FAIXA}`,
    border: "border-l-4 border-l-flag-azul",
    column: "bg-flag-azul text-white",
    dot:    "bg-flag-azul",
    text:   "text-info-400",
  },
  washing: {
    label:  "Lavagem",
    badge:  `bg-flag-azul text-white ${FAIXA}`,
    border: "border-l-4 border-l-flag-azul",
    column: "bg-flag-azul text-white",
    dot:    "bg-flag-azul",
    text:   "text-info-400",
  },

  // ── Saída / Conclusão ─────────────────────────────────────────────────────
  final_survey: {
    label:  "Vistoria Final",
    badge:  `bg-flag-grafite text-flag-gelo ${FAIXA}`,
    border: "border-l-4 border-l-flag-aluminio",
    column: "bg-flag-grafite text-flag-gelo",
    dot:    "bg-flag-aluminio",
    text:   "text-muted-foreground",
  },
  ready: {
    label:  "Pronto p/ Entrega",
    badge:  `bg-flag-verde text-white ${FAIXA}`,
    border: "border-l-4 border-l-flag-verde",
    column: "bg-flag-verde text-white",
    dot:    "bg-flag-verde",
    text:   "text-success-400",
  },
  delivered: {
    label:  "Entregue",
    badge:  `bg-muted text-muted-foreground ${FAIXA}`,
    border: "border-l-4 border-l-flag-aluminio",
    column: "bg-flag-aluminio text-black",
    dot:    "bg-flag-aluminio",
    text:   "text-muted-foreground",
  },

  // ── Cancelado ─────────────────────────────────────────────────────────────
  cancelled: {
    label:  "Cancelada",
    badge:  `bg-muted text-muted-foreground line-through ${FAIXA}`,
    border: "border-l-4 border-l-border",
    column: "bg-muted text-muted-foreground",
    dot:    "bg-muted-foreground",
    text:   "text-muted-foreground",
  },
} as const;

// ─── Kanban ───────────────────────────────────────────────────────────────────

/** Ordem das colunas no board Kanban */
export const KANBAN_COLUMNS_ORDER: ServiceOrderStatus[] = [
  "reception",
  "initial_survey",
  "budget",
  "waiting_auth",
  "authorized",
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
  "cancelled",
];

/** Status que ficam ocultos por padrão no Kanban */
export const KANBAN_HIDDEN_BY_DEFAULT: ServiceOrderStatus[] = [
  "delivered",
  "cancelled",
];

/** Statuses considerados "abertos" (não concluídos) */
export const OPEN_STATUSES: ServiceOrderStatus[] = KANBAN_COLUMNS_ORDER.filter(
  (s) => s !== "delivered"
);

// ─── Grupos de fase no Kanban ─────────────────────────────────────────────────

export interface KanbanPhaseGroup {
  id: string;
  label: string;
  statuses: ServiceOrderStatus[];
  /** Classe Tailwind para o header do grupo */
  headerClass: string;
}

export const KANBAN_PHASE_GROUPS: KanbanPhaseGroup[] = [
  {
    id: "intake",
    label: "Entrada",
    statuses: ["reception", "initial_survey", "budget", "waiting_auth", "authorized"],
    headerClass:
      "bg-blue-50 text-blue-700 border-b border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
  },
  {
    id: "production",
    label: "Produção",
    statuses: ["waiting_parts", "repair", "mechanic", "bodywork", "painting", "assembly"],
    headerClass:
      "bg-red-50 text-red-700 border-b border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20",
  },
  {
    id: "finishing",
    label: "Acabamento",
    statuses: ["polishing", "washing", "final_survey"],
    headerClass:
      "bg-yellow-50 text-yellow-700 border-b border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/20",
  },
  {
    id: "delivery",
    label: "Saída",
    statuses: ["ready", "delivered"],
    headerClass:
      "bg-green-50 text-green-700 border-b border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20",
  },
  {
    id: "cancelled",
    label: "Canceladas",
    statuses: ["cancelled"],
    headerClass:
      "bg-neutral-100 text-neutral-500 border-b border-neutral-200 dark:bg-neutral-500/10 dark:text-neutral-400 dark:border-neutral-500/20",
  },
];

// ─── Pastas de fotos ──────────────────────────────────────────────────────────

export interface FolderConfig {
  label: string;
  description: string;
  /** Nome do ícone Lucide */
  icon: string;
  /** Classe de cor Tailwind para ícone/texto */
  color: string;
  /** Classe de fundo Tailwind para o header da pasta */
  bgColor: string;
  /** Classe de borda Tailwind */
  borderColor: string;
}

export const OS_PHOTO_FOLDERS: Record<OSPhotoFolder, FolderConfig> = {
  vistoria_inicial: {
    label: "Vistoria Inicial",
    description: "Fotos de chegada do veículo antes de qualquer serviço",
    icon: "Camera",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  checklist_entrada: {
    label: "Checklist de Entrada",
    description: "Checklist, formulários e documentos de recepção",
    icon: "ClipboardCheck",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20",
  },
  acompanhamento: {
    label: "Acompanhamento de Reparos",
    description: "Fotos do progresso dos serviços em execução",
    icon: "Wrench",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  complemento: {
    label: "Complemento",
    description: "Danos adicionais encontrados durante o reparo",
    icon: "AlertCircle",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  vistoria_final: {
    label: "Vistoria Final",
    description: "Fotos finais após conclusão de todos os serviços",
    icon: "CheckCircle",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
  documentos: {
    label: "Documentos",
    description: "Laudos, notas fiscais e documentos do sinistro",
    icon: "FileText",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
  },
  orcamentos: {
    label: "Orçamentos",
    description: "Orçamentos, propostas e comparativos de peças",
    icon: "Receipt",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
  },
} as const;

export const OS_PHOTO_FOLDER_ORDER: OSPhotoFolder[] = [
  "vistoria_inicial",
  "checklist_entrada",
  "acompanhamento",
  "complemento",
  "vistoria_final",
  "documentos",
  "orcamentos",
];

// ─── Helpers de dias na oficina ───────────────────────────────────────────────

/**
 * Retorna classe Tailwind de cor de texto baseada nos dias na oficina.
 * Verde ≤ 7 dias · Amarelo 8–14 · Laranja 15–21 · Vermelho > 21
 */
export function getDaysInShopColor(days: number | null): string {
  if (days === null) return "text-neutral-400";
  if (days <= 7)  return "text-emerald-600";
  if (days <= 14) return "text-amber-500";
  if (days <= 21) return "text-orange-500";
  return "text-red-600";
}

/**
 * Retorna classe Tailwind de borda esquerda baseada nos dias na oficina.
 */
export function getDaysInShopBorderColor(days: number | null): string {
  if (days === null) return "";
  if (days <= 7)  return "";
  if (days <= 14) return "border-l-amber-400";
  if (days <= 21) return "border-l-orange-500";
  return "border-l-red-500";
}

/**
 * Retorna badge classes de urgência baseada nos dias de atraso.
 */
export function getUrgencyBadgeClass(daysOverdue: number): string {
  if (daysOverdue > 0)  return "bg-red-100 text-red-700 border border-red-200";
  if (daysOverdue === 0) return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-blue-50 text-blue-600 border border-blue-100";
}

// ─── Role labels ──────────────────────────────────────────────────────────────

export const ROLE_LABEL: Record<PaddockRole, string> = {
  OWNER:       "Proprietário",
  ADMIN:       "Administrador",
  MANAGER:     "Gerente",
  CONSULTANT:  "Consultor",
  STOREKEEPER: "Almoxarife",
} as const;
