"use client"

import Link from "next/link"
import { ClipboardList, Truck, AlertTriangle, CheckCircle } from "lucide-react"
import { StatCard } from "./StatCard"
import type { ConsultantDashboardStats } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"

interface Props {
  data: ConsultantDashboardStats
}

export function ConsultantDashboard({ data }: Props) {
  return (
    <div className="space-y-6">
      {/* Cards KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Minhas OS Abertas"
          value={data.my_open}
          icon={<ClipboardList className="h-5 w-5 text-info-600" />}
          iconBg="bg-info-50"
        />
        <StatCard
          label="Entregas Hoje"
          value={data.my_deliveries_today}
          icon={<Truck className="h-5 w-5 text-success-600" />}
          iconBg="bg-success-50"
        />
        <StatCard
          label="OS Atrasadas"
          value={data.my_overdue}
          icon={<AlertTriangle className={`h-5 w-5 ${data.my_overdue > 0 ? "text-red-600" : "text-neutral-400"}`} />}
          iconBg={data.my_overdue > 0 ? "bg-red-50" : "bg-neutral-50"}
        />
        <StatCard
          label="Entregues esta Semana"
          value={data.my_completed_week}
          icon={<CheckCircle className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50"
        />
      </div>

      {/* OS recentes */}
      <div className="bg-white rounded-md border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-700">Minhas OS em Andamento</h2>
        </div>
        {data.my_recent_os.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">Nenhuma OS em andamento.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-xs font-semibold uppercase text-neutral-400">
                <th className="px-4 py-2.5 text-left">Placa</th>
                <th className="px-4 py-2.5 text-left">Cliente</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Dias na Oficina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.my_recent_os.map((os) => {
                const config = SERVICE_ORDER_STATUS_CONFIG[os.status as keyof typeof SERVICE_ORDER_STATUS_CONFIG]
                return (
                  <tr key={os.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/service-orders/${os.id}`} className="font-mono text-sm font-bold text-neutral-800 hover:text-info-600">
                        {os.plate}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{os.customer_name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config?.badge ?? "bg-neutral-100 text-neutral-600"}`}>
                        {os.status_display}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={os.days_in_shop > 14 ? "text-red-600 font-semibold" : "text-neutral-600"}>
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
