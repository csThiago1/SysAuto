/**
 * EmptyState — Estado vazio padrão para listas e tabelas
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 rounded-full bg-white/[0.03] p-4 text-white/30">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-white/70">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-white/50 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
