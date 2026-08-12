"use client"

import Link from "next/link"
import { ClipboardList, Truck, AlertTriangle, CheckCircle } from "lucide-react"
import type { ConsultantDashboardStats } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import { SectionLabel } from "@/components/ui/section-label"
import { KpiStrip, type KpiItem } from "@/components/ui/kpi-strip"
import { ScrollFade } from "@/components/ui/scroll-fade"
import { cn } from "@/lib/utils"

interface Props {
  data: ConsultantDashboardStats
}

export function ConsultantDashboard({ data }: Props) {
  const kpis: KpiItem[] = [
    {
      label: "OS abertas",
      value: String(data.my_open),
      icon: <ClipboardList size={14} />,
      iconClass: "bg-info-500/10 text-info-400",
    },
    {
      label: "Entregas hoje",
      value: String(data.my_deliveries_today),
      icon: <Truck size={14} />,
      iconClass: "bg-success-500/10 text-success-400",
    },
    {
      label: "Atrasadas",
      value: String(data.my_overdue),
      icon: <AlertTriangle size={14} />,
      iconClass: "bg-error-500/10 text-error-400",
      valueClass: data.my_overdue > 0 ? "text-error-400" : undefined,
    },
    {
      label: "Entregues (semana)",
      value: String(data.my_completed_week),
      icon: <CheckCircle size={14} />,
      iconClass: "bg-violet-500/10 text-violet-400",
    },
  ]

  return (
    <div className="space-y-6">
      <SectionLabel>MEUS INDICADORES</SectionLabel>
      <KpiStrip items={kpis} />

      <SectionLabel>EM ANDAMENTO</SectionLabel>
      {/* OS recentes */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-foreground/70">Minhas OS em Andamento</h2>
        </div>
        {data.my_recent_os.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma OS em andamento.</p>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-2 p-2">
              {data.my_recent_os.map((os) => {
                const config = SERVICE_ORDER_STATUS_CONFIG[os.status as keyof typeof SERVICE_ORDER_STATUS_CONFIG]
                return (
                  <Link
                    key={os.id}
                    href={`/os/${os.number}`}
                    className="relative block rounded-[11px] bg-card px-3 py-2.5 hover:bg-primary/5 transition-colors"
                  >
                    <span aria-hidden className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px]", config?.dot ?? "bg-muted")} />
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[13px] font-semibold text-foreground/90">{os.plate}</span>
                      <span className={cn("text-[11px] font-semibold shrink-0", config?.text ?? "text-muted-foreground")}>
                        {os.status_display}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 mt-0.5">
                      <span className="text-[13px] text-foreground/60 truncate">{os.customer_name || "—"}</span>
                      <span className={cn("shrink-0 font-mono text-[11.5px] tabular-nums", os.days_in_shop > 14 ? "text-error-400 font-semibold" : "text-muted-foreground")}>
                        {os.days_in_shop}d
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block">
              <ScrollFade>
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
                            <Link href={`/os/${os.number}`} className="font-mono text-sm font-bold text-foreground/90 hover:text-info-600">
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
                            <span className={os.days_in_shop > 14 ? "text-error-600 font-semibold" : "text-foreground/60"}>
                              {os.days_in_shop}d
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ScrollFade>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
