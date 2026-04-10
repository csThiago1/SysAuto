"use client";

/**
 * DashboardPage — Página de visão geral das OS
 *
 * ANTES: 263 linhas com helpers inline, dois fetches, tabela e cards tudo aqui.
 * AGORA: ~55 linhas — apenas composição de _components/, dados via hooks barrel.
 *
 * Tipos: @paddock/types · Utils: @paddock/utils · Hooks: @/hooks · UI: @/components/ui
 */

import React from "react";
import Link from "next/link";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import type { ServiceOrderStatus } from "@paddock/types";
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils";
import { useDashboardStats, useServiceOrders } from "@/hooks";
import { Skeleton, StatusBadge } from "@/components/ui";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StatCard } from "./_components/StatCard";
import { RecentOSTable } from "./_components/RecentOSTable";

export default function DashboardPage(): React.ReactElement {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: ordersData, isLoading: ordersLoading } = useServiceOrders({
    ordering: "-opened_at",
    page: "1",
    page_size: "5",
  });

  // Top statuses by count (máx 4, exceto delivered/cancelled)
  const topStatuses = React.useMemo<{ status: ServiceOrderStatus; count: number }[]>(() => {
    if (!stats?.by_status) return [];
    return (Object.entries(stats.by_status) as [ServiceOrderStatus, number][])
      .filter(([s]) => s !== "delivered" && s !== "cancelled")
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([status, count]) => ({ status, count }));
  }, [stats]);

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Visão geral das Ordens de Serviço
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCard.Skeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="OS em Aberto"
                value={stats?.total_open ?? 0}
                iconBg="bg-primary-100"
                icon={<ClipboardList className="h-5 w-5 text-primary-600" />}
              />
              <StatCard
                label="Entregas Hoje"
                value={stats?.today_deliveries ?? 0}
                iconBg="bg-success-100"
                icon={<CheckCircle2 className="h-5 w-5 text-success-600" />}
              />
              {topStatuses.map(({ status, count }) => (
                <StatCard
                  key={status}
                  label={SERVICE_ORDER_STATUS_CONFIG[status].label}
                  value={count}
                  iconBg="bg-neutral-100"
                  icon={<span className={`h-2.5 w-2.5 rounded-full ${SERVICE_ORDER_STATUS_CONFIG[status].dot}`} />}
                />
              ))}
            </>
          )}
        </div>

        {/* Recent OS */}
        <div className="rounded-md bg-white shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-card-padding py-4 border-b border-neutral-100">
            <h2 className="text-base font-semibold text-neutral-900">
              Últimas Ordens de Serviço
            </h2>
            <Link
              href="/service-orders"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Ver todas →
            </Link>
          </div>

          {ordersLoading ? (
            <div className="p-card-padding space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <RecentOSTable orders={ordersData?.results ?? []} />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
