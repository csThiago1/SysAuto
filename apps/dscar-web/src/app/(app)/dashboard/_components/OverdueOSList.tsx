"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import type { OverdueOSItem } from "@paddock/types"

interface Props {
  items: OverdueOSItem[]
}

export function OverdueOSList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-md border border-neutral-200 shadow-sm p-4 flex items-center gap-2">
        <span className="text-emerald-500 text-sm font-medium">✓ Nenhuma OS atrasada</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-md border border-red-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-red-100 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <h3 className="text-sm font-semibold text-red-700">{items.length} OS Atrasadas</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-red-50">
          <tr className="text-[11px] font-semibold uppercase text-red-400">
            <th className="px-4 py-2 text-left">OS / Placa</th>
            <th className="px-4 py-2 text-left">Cliente</th>
            <th className="px-4 py-2 text-right">Previsão</th>
            <th className="px-4 py-2 text-right">Atraso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-red-50">
          {items.map((os) => (
            <tr key={os.id} className="hover:bg-red-50/50">
              <td className="px-4 py-2">
                <Link href={`/service-orders/${os.id}`} className="font-medium text-neutral-800 hover:text-blue-600">
                  #{os.number} · {os.plate}
                </Link>
              </td>
              <td className="px-4 py-2 text-neutral-500">{os.customer_name || "—"}</td>
              <td className="px-4 py-2 text-right text-neutral-500">
                {new Date(os.estimated_delivery_date + "T12:00:00").toLocaleDateString("pt-BR")}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-red-600">
                {os.days_overdue}d
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
