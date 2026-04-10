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
        <div className="mb-4 rounded-full bg-neutral-100 p-4 text-neutral-400">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-neutral-700">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-neutral-500 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
