/**
 * @paddock/types — UI Component Contracts
 * Props base reutilizáveis para componentes do sistema.
 * Import: import type { ModalProps, TableProps } from "@paddock/types"
 */

// ─── Modais ───────────────────────────────────────────────────────────────────

/** Props base para qualquer modal do sistema */
export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Tabelas e listas ─────────────────────────────────────────────────────────

/** Props base para componentes de listagem tabular */
export interface TableProps<TItem> {
  items: TItem[];
  isLoading?: boolean;
  emptyMessage?: string;
}

// ─── Formulários ──────────────────────────────────────────────────────────────

/** Props base para formulários de criação/edição */
export interface FormProps<TData> {
  defaultValues?: Partial<TData>;
  onSuccess?: (result: TData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

// ─── Badges e variantes visuais ───────────────────────────────────────────────

/** Variante de tamanho para badges e chips */
export type BadgeSize = "xs" | "sm" | "md";

/** Variante de estado visual genérica */
export type StatusVariant = "active" | "inactive" | "pending" | "error" | "warning";

// ─── IA ───────────────────────────────────────────────────────────────────────

export type RecommendationUrgency = "critical" | "high" | "medium" | "low";

export interface AIRecommendationItem {
  service: string;
  urgency: RecommendationUrgency;
  reason: string;
  estimated_price_range: { min: number; max: number };
}
