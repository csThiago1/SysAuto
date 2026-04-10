/**
 * DS Car Design Tokens — ARQUIVO LEGADO (retrocompatibilidade)
 *
 * ⚠️  ATENÇÃO: Este arquivo é um proxy de @paddock/utils.
 *     Para novos arquivos, importe diretamente de @paddock/utils:
 *
 *       import { SERVICE_ORDER_STATUS_CONFIG, KANBAN_COLUMNS_ORDER } from "@paddock/utils"
 *
 * Este arquivo existe apenas para não quebrar imports existentes.
 * Será removido após migração completa dos arquivos restantes.
 *
 * MIGRAÇÃO: Todos os novos arquivos DEVEM importar de @paddock/utils.
 *
 * Erros corrigidos:
 *   ERRO-03: STATUS_COLORS duplicada em StatusBadge.tsx — resolvido
 *   ERRO-02: formatDate inline — resolvido, use @paddock/utils
 */

// Re-exporta tudo de @paddock/utils para retrocompatibilidade
export {
  SERVICE_ORDER_STATUS_CONFIG,
  KANBAN_COLUMNS_ORDER,
  KANBAN_HIDDEN_BY_DEFAULT,
  OPEN_STATUSES,
  ROLE_LABEL,
  type StatusConfig,
} from "@paddock/utils";

// URGENCY_CONFIG não foi movido — mantido aqui por ser específico do frontend de IA
import type { RecommendationUrgency } from "@paddock/types";

export const URGENCY_CONFIG: Record<
  RecommendationUrgency,
  { label: string; badge: string; dot: string; icon: string }
> = {
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
