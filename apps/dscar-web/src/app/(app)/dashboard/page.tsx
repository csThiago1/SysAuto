"use client"

import React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ClipboardList, CheckCircle2, Plus } from "lucide-react"
import type { ServiceOrderStatus } from "@paddock/types"
import { ROLE_HIERARCHY } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import { useDashboardStats, useServiceOrders } from "@/hooks"
import { Skeleton, StatusBadge } from "@/components/ui"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { StatCard } from "./_components/StatCard"
import { RecentOSTable } from "./_components/RecentOSTable"
import { ConsultantDashboard } from "./_components/ConsultantDashboard"
import { ManagerDashboard } from "./_components/ManagerDashboard"
import type { ConsultantDashboardStats, ManagerDashboardStats } from "@paddock/types"

export default function DashboardPage(): React.ReactElement {
  const { data: session } = useSession()
  const role = session?.role ?? "STOREKEEPER"

  // Map PaddockRole → API role param
  const roleParam = React.useMemo(() => {
    if (role === "CONSULTANT") return "CONSULTANT"
    if (ROLE_HIERARCHY[role] >= ROLE_HIERARCHY["MANAGER"]) return "MANAGER"
    return undefined
  }, [role])

  const { data: stats, isLoading: statsLoading } = useDashboardStats(roleParam)

  // Legacy view data (STOREKEEPER or unknown roles)
  const { data: ordersData, isLoading: ordersLoading } = useServiceOrders(
    roleParam ? {} : { ordering: "-opened_at", page: "1", page_size: "5" }
  )

  const topStatuses = React.useMemo<{ status: ServiceOrderStatus; count: number }[]>(() => {
    if (!stats || "role" in stats) return []
    const legacy = stats as { by_status?: Record<ServiceOrderStatus, number> }
    if (!legacy.by_status) return []
    return (Object.entries(legacy.by_status) as [ServiceOrderStatus, number][])
      .filter(([s]) => s !== "delivered" && s !== "cancelled")
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([status, count]) => ({ status, count }))
  }, [stats])

  // Role-based render
  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
            <p className="mt-0.5 text-sm text-neutral-500">Carregando...</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCard.Skeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (stats && "role" in stats && stats.role === "consultant") {
    return (
      <ErrorBoundary>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
              <p className="mt-0.5 text-sm text-neutral-500">Meu painel de atendimento</p>
            </div>
            <Link
              href="/service-orders/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#ea0e03] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <Plus size={16} />
              Nova OS
            </Link>
          </div>
          <ConsultantDashboard data={stats as ConsultantDashboardStats} />
        </div>
      </ErrorBoundary>
    )
  }

  if (stats && "role" in stats && stats.role === "manager") {
    return (
      <ErrorBoundary>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
              <p className="mt-0.5 text-sm text-neutral-500">Visão gerencial</p>
            </div>
            <Link
              href="/service-orders/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#ea0e03] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <Plus size={16} />
              Nova OS
            </Link>
          </div>
          <ManagerDashboard data={stats as ManagerDashboardStats} />
        </div>
      </ErrorBoundary>
    )
  }

  // Legacy fallback (STOREKEEPER or no role param)
  const legacyStats = stats as { total_open?: number; today_deliveries?: number } | undefined
  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
            <p className="mt-0.5 text-sm text-neutral-500">Visão geral das Ordens de Serviço</p>
          </div>
          <Link
            href="/service-orders/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#ea0e03] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            <Plus size={16} />
            Nova OS
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="OS em Aberto"
            value={legacyStats?.total_open ?? 0}
            iconBg="bg-primary-100"
            icon={<ClipboardList className="h-5 w-5 text-primary-600" />}
          />
          <StatCard
            label="Entregas Hoje"
            value={legacyStats?.today_deliveries ?? 0}
            iconBg="bg-success-100"
            icon={<CheckCircle2 className="h-5 w-5 text-success-600" />}
          />
          {topStatuses.map(({ status, count }) => (
            <StatCard
              key={status}
              label={SERVICE_ORDER_STATUS_CONFIG[status].label}
              value={count}
              iconBg="bg-neutral-100"
              icon={
                <span
                  className={`h-2.5 w-2.5 rounded-full ${SERVICE_ORDER_STATUS_CONFIG[status].dot}`}
                />
              }
            />
          ))}
        </div>

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
  )
}
