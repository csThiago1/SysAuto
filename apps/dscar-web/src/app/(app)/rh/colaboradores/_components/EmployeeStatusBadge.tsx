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
  success: "bg-success-100 text-success-700 border-success-200",
  warning: "bg-warning-100 text-warning-700 border-warning-200",
  destructive: "bg-red-100 text-red-700 border-red-200",
  default: "bg-white/5 text-white/60 border-white/10",
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
