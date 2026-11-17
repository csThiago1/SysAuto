"use client"

import React from "react"
import { useSession } from "next-auth/react"
import { ROLE_HIERARCHY, type PaddockRole } from "@paddock/types"
import type { ConsultantDashboardStats, ManagerDashboardStats } from "@paddock/types"
import { useDashboardStats } from "@/hooks"
import { Skeleton } from "@/components/ui"
import { PageHeader } from "@/components/ui/page-header"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { TorreDeTempos } from "./_components/TorreDeTempos"
import { ConsultantDashboard } from "./_components/ConsultantDashboard"
import { ManagerDashboard } from "./_components/ManagerDashboard"

export default function DashboardPage(): React.ReactElement {
  const { data: session, status } = useSession()
  const role = (session?.role ?? "STOREKEEPER") as PaddockRole
  const level = ROLE_HIERARCHY[role] ?? 0

  // Map PaddockRole → API role param
  const roleParam =
    role === "CONSULTANT" ? "CONSULTANT" : level >= ROLE_HIERARCHY.MANAGER ? "MANAGER" : undefined

  const { data: stats, isLoading } = useDashboardStats(roleParam, status === "authenticated" && !!roleParam)
  const papel = stats && "role" in stats ? stats.role : undefined

  return (
    <ErrorBoundary>
      <div className="space-y-8">
        <PageHeader
          title="Dashboard"
          description={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        />

        {/* 1 — O pátio agora: todo mundo vê, na ordem do que precisa de atenção */}
        <TorreDeTempos />

        {/* 2 — O mês (gerente) ou a minha carteira (consultor) */}
        {roleParam && isLoading && <Skeleton className="h-40 w-full" />}
        {papel === "manager" && <ManagerDashboard data={stats as ManagerDashboardStats} />}
        {papel === "consultant" && <ConsultantDashboard data={stats as ConsultantDashboardStats} />}
      </div>
    </ErrorBoundary>
  )
}
