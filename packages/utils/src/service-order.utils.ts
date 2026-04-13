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
}

export const SERVICE_ORDER_STATUS_CONFIG: Record<ServiceOrderStatus, StatusConfig> = {
  // ── Fases Administrativas (azul) ──────────────────────────────────────────
  reception: {
    label:  "Recepção",
    badge:  "bg-blue-100 text-blue-800 border border-blue-200",
    border: "border-l-4 border-l-blue-400",
    column: "bg-blue-600 text-white",
    dot:    "bg-blue-500",
  },
  initial_survey: {
    label:  "Vistoria Inicial",
    badge:  "bg-blue-100 text-blue-800 border border-blue-200",
    border: "border-l-4 border-l-blue-500",
    column: "bg-blue-700 text-white",
    dot:    "bg-blue-600",
  },
  budget: {
    label:  "Orçamento",
    badge:  "bg-sky-100 text-sky-700 border border-sky-200",
    border: "border-l-4 border-l-sky-400",
    column: "bg-sky-700 text-white",
    dot:    "bg-sky-500",
  },

  // ── Fases de Autorização ──────────────────────────────────────────────────
  waiting_auth: {
    label:  "Aguard. Autorização",
    badge:  "bg-amber-100 text-amber-800 border border-amber-200",
    border: "border-l-4 border-l-amber-500",
    column: "bg-amber-700 text-white",
    dot:    "bg-amber-500",
  },
  authorized: {
    label:  "Autorizada",
    badge:  "bg-emerald-100 text-emerald-800 border border-emerald-200",
    border: "border-l-4 border-l-emerald-500",
    column: "bg-emerald-700 text-white",
    dot:    "bg-emerald-500",
  },

  // ── Aguardando Peças ──────────────────────────────────────────────────────
  waiting_parts: {
    label:  "Aguardando Peças",
    badge:  "bg-amber-50 text-amber-700 border border-amber-200",
    border: "border-l-4 border-l-amber-400",
    column: "bg-amber-600 text-white",
    dot:    "bg-amber-400",
  },

  // ── Trabalho Ativo (vermelho/laranja) ─────────────────────────────────────
  repair: {
    label:  "Em Reparo",
    badge:  "bg-red-100 text-red-800 border border-red-200",
    border: "border-l-4 border-l-red-500",
    column: "bg-red-700 text-white",
    dot:    "bg-red-500",
  },
  mechanic: {
    label:  "Mecânica",
    badge:  "bg-orange-100 text-orange-800 border border-orange-200",
    border: "border-l-4 border-l-orange-500",
    column: "bg-orange-700 text-white",
    dot:    "bg-orange-500",
  },

  // ── Especializado (roxo) ──────────────────────────────────────────────────
  bodywork: {
    label:  "Funilaria",
    badge:  "bg-purple-100 text-purple-800 border border-purple-200",
    border: "border-l-4 border-l-purple-500",
    column: "bg-purple-700 text-white",
    dot:    "bg-purple-500",
  },
  painting: {
    label:  "Pintura",
    badge:  "bg-violet-100 text-violet-800 border border-violet-200",
    border: "border-l-4 border-l-violet-500",
    column: "bg-violet-700 text-white",
    dot:    "bg-violet-500",
  },
  assembly: {
    label:  "Montagem",
    badge:  "bg-indigo-100 text-indigo-800 border border-indigo-200",
    border: "border-l-4 border-l-indigo-500",
    column: "bg-indigo-700 text-white",
    dot:    "bg-indigo-500",
  },

  // ── Acabamento ────────────────────────────────────────────────────────────
  polishing: {
    label:  "Polimento",
    badge:  "bg-yellow-100 text-yellow-800 border border-yellow-200",
    border: "border-l-4 border-l-yellow-400",
    column: "bg-yellow-700 text-white",
    dot:    "bg-yellow-500",
  },
  washing: {
    label:  "Lavagem",
    badge:  "bg-cyan-100 text-cyan-800 border border-cyan-200",
    border: "border-l-4 border-l-cyan-400",
    column: "bg-cyan-700 text-white",
    dot:    "bg-cyan-500",
  },

  // ── Saída / Conclusão ─────────────────────────────────────────────────────
  final_survey: {
    label:  "Vistoria Final",
    badge:  "bg-teal-100 text-teal-800 border border-teal-200",
    border: "border-l-4 border-l-teal-500",
    column: "bg-teal-700 text-white",
    dot:    "bg-teal-500",
  },
  ready: {
    label:  "Pronto p/ Entrega",
    badge:  "bg-green-100 text-green-800 border border-green-200",
    border: "border-l-4 border-l-green-500",
    column: "bg-green-700 text-white",
    dot:    "bg-green-500",
  },
  delivered: {
    label:  "Entregue",
    badge:  "bg-green-50 text-green-700 border border-green-200",
    border: "border-l-4 border-l-green-400",
    column: "bg-green-800 text-white",
    dot:    "bg-green-400",
  },

  // ── Cancelado ─────────────────────────────────────────────────────────────
  cancelled: {
    label:  "Cancelada",
    badge:  "bg-neutral-100 text-neutral-500 border border-neutral-200",
    border: "border-l-4 border-l-neutral-300",
    column: "bg-neutral-600 text-white",
    dot:    "bg-neutral-400",
  },
} as const;

// ─── Kanban ───────────────────────────────────────────────────────────────────

/** Ordem das colunas no board Kanban (exceto cancelled) */
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
    headerClass: "bg-blue-50 text-blue-700 border-b border-blue-200",
  },
  {
    id: "production",
    label: "Produção",
    statuses: ["waiting_parts", "repair", "mechanic", "bodywork", "painting", "assembly"],
    headerClass: "bg-red-50 text-red-700 border-b border-red-200",
  },
  {
    id: "finishing",
    label: "Acabamento",
    statuses: ["polishing", "washing", "final_survey"],
    headerClass: "bg-yellow-50 text-yellow-700 border-b border-yellow-200",
  },
  {
    id: "delivery",
    label: "Saída",
    statuses: ["ready", "delivered"],
    headerClass: "bg-green-50 text-green-700 border-b border-green-200",
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
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  checklist_entrada: {
    label: "Checklist de Entrada",
    description: "Checklist, formulários e documentos de recepção",
    icon: "ClipboardCheck",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
  acompanhamento: {
    label: "Acompanhamento de Reparos",
    description: "Fotos do progresso dos serviços em execução",
    icon: "Wrench",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  complemento: {
    label: "Complemento",
    description: "Danos adicionais encontrados durante o reparo",
    icon: "AlertCircle",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  vistoria_final: {
    label: "Vistoria Final",
    description: "Fotos finais após conclusão de todos os serviços",
    icon: "CheckCircle",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  documentos: {
    label: "Documentos",
    description: "Laudos, notas fiscais e documentos do sinistro",
    icon: "FileText",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
  },
  orcamentos: {
    label: "Orçamentos",
    description: "Orçamentos, propostas e comparativos de peças",
    icon: "Receipt",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
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
