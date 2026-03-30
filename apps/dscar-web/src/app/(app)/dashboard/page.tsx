"use client";

import React from "react";
import Link from "next/link";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats, useServiceOrders } from "@/hooks/useServiceOrders";
import { SERVICE_ORDER_STATUS_CONFIG } from "@/lib/design-tokens";
import type { ServiceOrderStatus } from "@paddock/types";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ label, value, icon, iconBg }: StatCardProps): React.ReactElement {
  return (
    <div className="rounded-md bg-white p-card-padding shadow-card hover:shadow-card-hover transition-shadow duration-normal">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold text-neutral-900 font-plate">
            {formatNumber(value)}
          </p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-md", iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

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

// ─── Status Breakdown Card ─────────────────────────────────────────────────────

interface StatusBreakdownProps {
  status: ServiceOrderStatus;
  count: number;
}

function StatusBreakdownCard({ status, count }: StatusBreakdownProps): React.ReactElement {
  const config = SERVICE_ORDER_STATUS_CONFIG[status];
  return (
    <div className="rounded-md bg-white p-card-padding shadow-card hover:shadow-card-hover transition-shadow duration-normal flex flex-col gap-2">
      <span className={cn("inline-self-start text-xs font-semibold rounded-full px-2.5 py-0.5 w-fit", config.badge)}>
        {config.label}
      </span>
      <p className="text-3xl font-bold text-neutral-900 font-plate">
        {formatNumber(count)}
      </p>
      <p className="text-xs text-neutral-400">ordens</p>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage(): React.ReactElement {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: ordersData, isLoading: ordersLoading } = useServiceOrders({
    ordering: "-opened_at",
    page: "1",
  });

  // Top 4 statuses by count
  const topStatuses: Array<{ status: ServiceOrderStatus; count: number }> = React.useMemo(() => {
    if (!stats?.by_status) return [];
    return (Object.entries(stats.by_status) as Array<[ServiceOrderStatus, number]>)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([status, count]) => ({ status, count }));
  }, [stats]);

  const recentOrders = ordersData?.results?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Visão geral das Ordens de Serviço
        </p>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            {/* OS em Aberto */}
            <StatCard
              label="OS em Aberto"
              value={stats?.total_open ?? 0}
              iconBg="bg-primary-100"
              icon={<ClipboardList className="h-5 w-5 text-primary-600" />}
            />

            {/* Entregas Hoje */}
            <StatCard
              label="Entregas Hoje"
              value={stats?.today_deliveries ?? 0}
              iconBg="bg-success-100"
              icon={<CheckCircle2 className="h-5 w-5 text-success-600" />}
            />

            {/* Top 4 status breakdown */}
            {topStatuses.map(({ status, count }) => (
              <StatusBreakdownCard key={status} status={status} count={count} />
            ))}

            {/* Fill empty slots if fewer than 2 statuses returned */}
            {Array.from({ length: Math.max(0, 2 - topStatuses.length) }).map(
              (_, i) => (
                <div key={`empty-${i}`} className="rounded-md bg-white p-card-padding shadow-card opacity-0" />
              )
            )}
          </>
        )}
      </div>

      {/* ── Recent OS Table ────────────────────────────────────────────────────── */}
      <div className="rounded-md bg-white shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-card-padding py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">
            Últimas Ordens de Serviço
          </h2>
          <Link
            href="/os"
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
        ) : recentOrders.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-400">
            Nenhuma ordem de serviço encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Nº
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Placa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {recentOrders.map((order) => {
                  const statusConfig = SERVICE_ORDER_STATUS_CONFIG[order.status];
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-plate font-semibold text-neutral-800">
                        #{formatNumber(order.number)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-plate font-bold tracking-wider text-neutral-900">
                          {order.plate}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">
                        {order.customer_name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            statusConfig.badge
                          )}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {formatDate(order.opened_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
