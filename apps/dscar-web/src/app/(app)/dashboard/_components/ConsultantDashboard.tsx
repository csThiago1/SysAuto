"use client"

import Link from "next/link"
import { ClipboardList, Truck, AlertTriangle, CheckCircle } from "lucide-react"
import { StatCard } from "./StatCard"
import type { ConsultantDashboardStats } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import { SectionDivider } from "@/components/ui/section-divider"

interface Props {
  data: ConsultantDashboardStats
}

export function ConsultantDashboard({ data }: Props) {
  return (
    <div className="space-y-6">
      <SectionDivider label="MEUS INDICADORES" />
      {/* Cards KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Minhas OS Abertas"
          value={data.my_open}
          icon={<ClipboardList className="h-5 w-5 text-info-600" />}
        />
        <StatCard
          label="Entregas Hoje"
          value={data.my_deliveries_today}
          icon={<Truck className="h-5 w-5 text-success-600" />}
        />
        <StatCard
          label="OS Atrasadas"
          value={data.my_overdue}
          icon={<AlertTriangle className={`h-5 w-5 ${data.my_overdue > 0 ? "text-red-600" : "text-muted-foreground"}`} />}
        />
        <StatCard
          label="Entregues esta Semana"
          value={data.my_completed_week}
          icon={<CheckCircle className="h-5 w-5 text-violet-600" />}
        />
      </div>

      <SectionDivider label="EM ANDAMENTO" />
      {/* OS recentes */}
      <div className="bg-muted/50 rounded-md border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-foreground/70">Minhas OS em Andamento</h2>
        </div>
        {data.my_recent_os.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma OS em andamento.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2.5 text-left label-mono text-muted-foreground">Placa</th>
                <th className="px-4 py-2.5 text-left label-mono text-muted-foreground">Cliente</th>
                <th className="px-4 py-2.5 text-left label-mono text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-right label-mono text-muted-foreground">Dias na Oficina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.my_recent_os.map((os) => {
                const config = SERVICE_ORDER_STATUS_CONFIG[os.status as keyof typeof SERVICE_ORDER_STATUS_CONFIG]
                return (
                  <tr key={os.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Link href={`/service-orders/${os.id}`} className="font-mono text-sm font-bold text-foreground/90 hover:text-info-600">
                        {os.plate}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-foreground/60">{os.customer_name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config?.badge ?? "bg-muted/50 text-foreground/60"}`}>
                        {os.status_display}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={os.days_in_shop > 14 ? "text-red-600 font-semibold" : "text-foreground/60"}>
                        {os.days_in_shop}d
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
