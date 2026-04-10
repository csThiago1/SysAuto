"use client";

/**
 * HRStatCard — Card de métrica para o Dashboard de RH
 * Mesmo padrão do StatCard do dashboard de OS.
 */

import React from "react";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface HRStatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  sub?: string;
}

function HRStatCardComponent({
  label,
  value,
  icon,
  iconBg,
  sub,
}: HRStatCardProps): React.ReactElement {
  return (
    <div className="rounded-md bg-white p-card-padding shadow-card hover:shadow-card-hover transition-shadow duration-normal">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold text-neutral-900 font-plate">
            {typeof value === "number"
              ? new Intl.NumberFormat("pt-BR").format(value)
              : value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md",
            iconBg
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function HRStatCardSkeleton(): React.ReactElement {
  return (
    <div className="rounded-md bg-white p-card-padding shadow-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-8 w-16 mt-1" />
        </div>
        <Skeleton className="h-10 w-10 rounded-md" />
      </div>
    </div>
  );
}

export const HRStatCard = Object.assign(HRStatCardComponent, {
  Skeleton: HRStatCardSkeleton,
});
