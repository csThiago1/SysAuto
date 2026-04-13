"use client"

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts"
import type { BillingMonthPoint } from "@paddock/types"

interface Props {
  data: BillingMonthPoint[]
  byType: { insurer: string; private: string }
}

function formatCurrency(value: number): string {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`
  return `R$${value.toFixed(0)}`
}

export function BillingByTypeChart({ data, byType }: Props) {
  const chartData = data.map((d) => ({
    month: d.month,
    valor: Number(d.amount),
  }))

  const totalMonth = Number(byType.insurer) + Number(byType.private)
  const insurerPct = totalMonth > 0 ? Math.round((Number(byType.insurer) / totalMonth) * 100) : 0

  return (
    <div className="bg-white rounded-md border border-neutral-200 shadow-sm p-4">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-700">Faturamento — Últimos 6 Meses</h3>
        <div className="flex gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded bg-blue-500" />
            Seguradora {insurerPct}%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500" />
            Particular {100 - insurerPct}%
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) =>
              value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            }
          />
          <Bar dataKey="valor" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Faturamento" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
