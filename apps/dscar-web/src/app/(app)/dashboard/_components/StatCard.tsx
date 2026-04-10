"use client";

/**
 * StatCard — Card de métrica para o Dashboard
 * Componente puro: recebe dados via props, sem hooks internos.
 * Tipos: número + ReactNode (icon) — sem dependência de @paddock/types
 */

import React from "react";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCardComponent({ label, value, icon, iconBg }: StatCardProps): React.ReactElement {
  return (
    <div className="rounded-md bg-white p-card-padding shadow-card hover:shadow-card-hover transition-shadow duration-normal">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold text-neutral-900 font-plate">
            {new Intl.NumberFormat("pt-BR").format(value)}
          </p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-md", iconBg)}>
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

// Namespace StatCard para agrupar o componente + skeleton
export const StatCard = Object.assign(StatCardComponent, {
  Skeleton: StatCardSkeleton,
});
