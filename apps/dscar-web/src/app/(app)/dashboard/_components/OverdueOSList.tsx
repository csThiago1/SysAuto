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
      <div className="bg-muted/50 rounded-md border border-border shadow-sm p-4 flex items-center gap-2">
        <span className="text-success-500 text-sm font-medium">✓ Nenhuma OS atrasada</span>
      </div>
    )
  }

  return (
    <div className="bg-muted/50 rounded-md border border-error-500/20 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-error-500/20 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-error-500" />
        <h3 className="text-sm font-semibold text-error-400">{items.length} OS Atrasadas</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-error-500/5">
          <tr className="text-xs font-semibold uppercase text-error-400">
            <th className="px-4 py-2 text-left">OS / Placa</th>
            <th className="px-4 py-2 text-left">Cliente</th>
            <th className="px-4 py-2 text-right">Previsão</th>
            <th className="px-4 py-2 text-right">Atraso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-error-500/10">
          {items.map((os) => (
            <tr key={os.id} className="hover:bg-error-500/5">
              <td className="px-4 py-2">
                <Link href={`/os/${os.number}`} className="font-medium text-foreground/90 hover:text-info-600">
                  #{os.number} · {os.plate}
                </Link>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{os.customer_name || "—"}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">
                {new Date(os.estimated_delivery_date + "T12:00:00").toLocaleDateString("pt-BR")}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-error-400">
                {os.days_overdue}d
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
