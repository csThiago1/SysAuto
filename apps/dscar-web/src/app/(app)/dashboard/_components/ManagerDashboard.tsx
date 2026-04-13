"use client"

import { DollarSign, Truck, TrendingUp, AlertTriangle } from "lucide-react"
import { StatCard } from "./StatCard"
import { BillingByTypeChart } from "./BillingByTypeChart"
import { TeamProductivityTable } from "./TeamProductivityTable"
import { OverdueOSList } from "./OverdueOSList"
import type { ManagerDashboardStats } from "@paddock/types"

interface Props {
  data: ManagerDashboardStats
}

function formatCurrency(value: string | number): string {
  const n = Number(value)
  if (n >= 1000) return `R$\u00a0${(n / 1000).toFixed(1)}k`
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
}

export function ManagerDashboard({ data }: Props) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Faturamento Mês"
          value={formatCurrency(data.billing_month)}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="Entregas (mês)"
          value={data.delivered_month}
          icon={<Truck className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Ticket Médio"
          value={formatCurrency(data.avg_ticket)}
          icon={<TrendingUp className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50"
        />
        <StatCard
          label="OS Atrasadas"
          value={data.overdue_count}
          icon={
            <AlertTriangle
              className={`h-5 w-5 ${data.overdue_count > 0 ? "text-red-600" : "text-neutral-400"}`}
            />
          }
          iconBg={data.overdue_count > 0 ? "bg-red-50" : "bg-neutral-50"}
        />
      </div>

      {/* Billing Chart */}
      <BillingByTypeChart
        data={data.billing_last_6_months}
        byType={data.billing_by_type}
      />

      {/* Productivity + Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamProductivityTable members={data.team_productivity} />
        <OverdueOSList items={data.overdue_os} />
      </div>
    </div>
  )
}
