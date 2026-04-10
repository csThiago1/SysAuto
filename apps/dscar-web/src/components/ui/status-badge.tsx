/**
 * StatusBadge — Badge de status de OS
 * Usa SERVICE_ORDER_STATUS_CONFIG de @paddock/utils.
 * Fonte de verdade única para cores de status no projeto.
 */

import type { ServiceOrderStatus } from "@paddock/types";
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ServiceOrderStatus;
  /** Override de label (usa o do config por padrão) */
  label?: string;
  size?: "sm" | "md";
  /** Mostrar ponto colorido antes do label */
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  label,
  size = "md",
  showDot = false,
  className,
}: StatusBadgeProps) {
  const cfg = SERVICE_ORDER_STATUS_CONFIG[status];
  const displayLabel = label ?? cfg.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        cfg.badge,
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      )}
      {displayLabel}
    </span>
  );
}
