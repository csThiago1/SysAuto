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
import { BillingSplit } from "./BillingSplit"

const BillingByTypeChart = dynamic(
  () => import("./BillingByTypeChart").then(m => ({ default: m.BillingByTypeChart })),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full" /> }
)

interface Props {
  data: ManagerDashboardStats
}

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

/** "Agosto/2026" — mês corrente, pro KPI nunca ficar sem contexto de período. */
function currentPeriodLabel(): string {
  const now = new Date()
  return `${MONTHS_PT[now.getMonth()]}/${now.getFullYear()}`
}

export function ManagerDashboard({ data }: Props) {
  const period = currentPeriodLabel()
  // O periodo e o mesmo para os tres primeiros: dizer uma vez no rotulo da
  // secao em vez de repetir (e truncar) em cada celula.
  const neutralIcon = "bg-muted/60 text-muted-foreground"
  const atrasadas = data.overdue_count > 0

  const kpis: KpiItem[] = [
    {
      label: "Faturamento",
      value: formatCurrency(data.billing_month, { compact: true }),
      icon: <DollarSign size={14} />,
      iconClass: neutralIcon,
    },
    {
      label: "Entregas",
      value: String(data.delivered_month),
      icon: <Truck size={14} />,
      iconClass: neutralIcon,
    },
    {
      label: "Ticket médio",
      value: formatCurrency(data.avg_ticket, { compact: true }),
      icon: <TrendingUp size={14} />,
      iconClass: neutralIcon,
    },
    {
      // Unico KPI com estado de negocio real — e o unico que ganha cor.
      label: "Atrasadas",
      value: String(data.overdue_count),
      icon: <AlertTriangle size={14} />,
      iconClass: atrasadas ? "bg-error-500/10 text-error-400" : neutralIcon,
      valueClass: atrasadas ? "text-error-400" : undefined,
    },
  ]

  return (
    <div className="space-y-5">
      {/* 1 — O que exige decisão agora. Só ocupa espaço quando existe; com zero
             atrasadas o KPI abaixo já diz, e um card "nenhuma atrasada" era
             ruído duplicado no topo da tela. */}
      {atrasadas && <OverdueOSList items={data.overdue_os} />}

      {/* 2 — O mês: os números e a forma real do negócio (seguradora × particular) */}
      <SectionLabel>Visão geral · {period}</SectionLabel>
      <div className="space-y-2">
        <KpiStrip items={kpis} />
        <BillingSplit
          insurer={data.billing_by_type.insurer}
          private={data.billing_by_type.private}
        />
      </div>

      {/* 3 — Tendência. Sem eyebrow: o próprio card já se chama
             "Faturamento — Últimos 6 Meses". */}
      <BillingByTypeChart data={data.billing_last_6_months} />

      {/* 4 — Equipe */}
      <SectionLabel>Equipe</SectionLabel>
      <TeamProductivityTable members={data.team_productivity} />
    </div>
  )
}
