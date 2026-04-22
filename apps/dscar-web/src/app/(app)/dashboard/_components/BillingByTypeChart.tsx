"use client"

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@paddock/utils"
import type { BillingMonthPoint } from "@paddock/types"

function formatMonth(month: string): string {
  // month is already formatted as "abr/26" by the API
  return month
}

interface Props {
  data: BillingMonthPoint[]
}

export function BillingByTypeChart({ data }: Props) {
  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    total: parseFloat(String(d.amount ?? 0)),
  }))

  return (
    <div className="bg-white/5 rounded-md border border-white/10 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-white/70 mb-4">
        Faturamento — Últimos 6 Meses
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [
              value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              "Faturamento",
            ]}
            labelStyle={{ fontWeight: 600 }}
          />
          <Bar dataKey="total" fill="#ea0e03" radius={[3, 3, 0, 0]} name="Faturamento" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
