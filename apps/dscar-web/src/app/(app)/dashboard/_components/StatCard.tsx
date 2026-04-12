"use client";

/**
 * StatCard — Card de métrica canônico (Dashboard, Financeiro, RH e demais módulos)
 * Componente puro: recebe dados via props, sem hooks internos.
 * Suporta número, string ou ReactNode em `value`.
 * Props opcionais: `sub` (subtexto) e `badge` (badge abaixo do valor).
 */

import React from "react";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string | React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  sub?: string;
  badge?: React.ReactNode;
}

function StatCardComponent({
  label,
  value,
  icon,
  iconBg,
  sub,
  badge,
}: StatCardProps): React.ReactElement {
  const formattedValue =
    typeof value === "number"
      ? new Intl.NumberFormat("pt-BR").format(value)
      : value;

  return (
    <div className="rounded-md bg-white p-card-padding shadow-card hover:shadow-card-hover transition-shadow duration-normal">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold text-neutral-900 font-plate">
            {formattedValue}
          </p>
          {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
          {badge && <div className="mt-1">{badge}</div>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md shrink-0",
            iconBg
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StatCardSkeleton(): React.ReactElement {
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

// Namespace StatCard: componente + skeleton
export const StatCard = Object.assign(StatCardComponent, {
  Skeleton: StatCardSkeleton,
});
