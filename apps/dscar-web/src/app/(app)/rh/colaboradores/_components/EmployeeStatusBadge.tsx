"use client";

import React from "react";
import type { EmployeeStatus } from "@paddock/types";
import { EMPLOYEE_STATUS_CONFIG } from "@paddock/types";
import { cn } from "@/lib/utils";

interface EmployeeStatusBadgeProps {
  status: EmployeeStatus;
  className?: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  success: "bg-success-500/10 text-success-400 border-success-500/20",
  warning: "bg-warning-500/10 text-warning-400 border-warning-500/20",
  destructive: "bg-error-500/10 text-error-400 border-error-500/20",
  default: "bg-muted/50 text-foreground/60 border-border",
};

export function EmployeeStatusBadge({
  status,
  className,
}: EmployeeStatusBadgeProps): React.ReactElement {
  const config = EMPLOYEE_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[config.variant],
        className
      )}
    >
      {config.label}
    </span>
  );
}
