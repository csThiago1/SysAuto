"use client"

import { DollarSign, Truck, TrendingUp, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@paddock/utils"
import { StatCard } from "./StatCard"
import { BillingByTypeChart } from "./BillingByTypeChart"
import { TeamProductivityTable } from "./TeamProductivityTable"
import { OverdueOSList } from "./OverdueOSList"
import type { ManagerDashboardStats } from "@paddock/types"
import { SectionDivider } from "@/components/ui/section-divider"

interface Props {
  data: ManagerDashboardStats
}

export function ManagerDashboard({ data }: Props) {
  return (
    <div className="space-y-6">
      <SectionDivider label="VISÃO GERAL" />
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Faturamento Mês"
          value={formatCurrency(data.billing_month, { compact: true })}
          icon={<DollarSign className="h-5 w-5 text-success-600" />}
        />
        <StatCard
          label="Entregas (mês)"
          value={data.delivered_month}
          icon={<Truck className="h-5 w-5 text-info-600" />}
        />
        <StatCard
          label="Ticket Médio"
          value={formatCurrency(data.avg_ticket, { compact: true })}
          icon={<TrendingUp className="h-5 w-5 text-violet-600" />}
        />
        <StatCard
          label="OS Atrasadas"
          value={data.overdue_count}
          icon={
            <AlertTriangle
              className={`h-5 w-5 ${data.overdue_count > 0 ? "text-red-600" : "text-white/40"}`}
            />
          }
        />
      </div>

      <SectionDivider label="FATURAMENTO" />
      {/* Billing Chart */}
      <BillingByTypeChart
        data={data.billing_last_6_months}
      />

      <SectionDivider label="EQUIPE" />
      {/* Productivity + Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamProductivityTable members={data.team_productivity} />
        <OverdueOSList items={data.overdue_os} />
      </div>
    </div>
  )
}
