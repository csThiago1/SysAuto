"use client";

/**
 * StatCard — Card de métrica canônico (Dashboard, Financeiro, RH e demais módulos)
 * Componente puro: recebe dados via props, sem hooks internos.
 * Suporta número, string ou ReactNode em `value`.
 * Props opcionais: `sub` (subtexto) e `badge` (badge abaixo do valor).
 */

import React from "react";
import { Skeleton } from "@/components/ui";

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string | React.ReactNode;
  icon: React.ReactNode;
  sub?: string;
  badge?: React.ReactNode;
}

function StatCardComponent({
  label,
  value,
  icon,
  sub,
  badge,
}: StatCardProps): React.ReactElement {
  const formattedValue =
    typeof value === "number"
      ? new Intl.NumberFormat("pt-BR").format(value)
      : value;

  return (
    <div className="rounded-md bg-white/5 p-card-padding shadow-card hover:shadow-card-hover transition-shadow duration-normal">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="label-mono text-white/40">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold text-white font-mono">
            {formattedValue}
          </p>
          {sub && <p className="mt-0.5 text-xs text-white/40">{sub}</p>}
          {badge && <div className="mt-1">{badge}</div>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md shrink-0 bg-white/[0.06]">
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StatCardSkeleton(): React.ReactElement {
  return (
    <div className="rounded-md bg-white/5 p-card-padding shadow-card">
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
