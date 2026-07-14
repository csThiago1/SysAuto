"use client"

import dynamic from "next/dynamic"
import { DollarSign, Truck, TrendingUp, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@paddock/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { TeamProductivityTable } from "./TeamProductivityTable"
import { OverdueOSList } from "./OverdueOSList"
import type { ManagerDashboardStats } from "@paddock/types"
import { SectionLabel } from "@/components/ui/section-label"
import { KpiStrip, type KpiItem } from "@/components/ui/kpi-strip"

const BillingByTypeChart = dynamic(
  () => import("./BillingByTypeChart").then(m => ({ default: m.BillingByTypeChart })),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full" /> }
)

interface Props {
  data: ManagerDashboardStats
}

export function ManagerDashboard({ data }: Props) {
  const kpis: KpiItem[] = [
    {
      label: "Faturamento",
      value: formatCurrency(data.billing_month, { compact: true }),
      icon: <DollarSign size={14} />,
      iconClass: "bg-success-500/10 text-success-400",
    },
    {
      label: "Entregas",
      value: String(data.delivered_month),
      icon: <Truck size={14} />,
      iconClass: "bg-info-500/10 text-info-400",
    },
    {
      label: "Ticket médio",
      value: formatCurrency(data.avg_ticket, { compact: true }),
      icon: <TrendingUp size={14} />,
      iconClass: "bg-violet-500/10 text-violet-400",
    },
    {
      label: "Atrasadas",
      value: String(data.overdue_count),
      icon: <AlertTriangle size={14} />,
      iconClass: "bg-error-500/10 text-error-400",
      valueClass: data.overdue_count > 0 ? "text-error-400" : undefined,
    },
  ]

  return (
    <div className="space-y-6">
      <SectionLabel>VISÃO GERAL</SectionLabel>
      <KpiStrip items={kpis} />

      <SectionLabel>FATURAMENTO</SectionLabel>
      {/* Billing Chart */}
      <BillingByTypeChart
        data={data.billing_last_6_months}
      />

      <SectionLabel>EQUIPE</SectionLabel>
      {/* Productivity + Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamProductivityTable members={data.team_productivity} />
        <OverdueOSList items={data.overdue_os} />
      </div>
    </div>
  )
}
