"use client"

import { useEffect, useState } from "react"
import { BarChart3 } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatCurrency } from "@paddock/utils"
import type { BillingMonthPoint } from "@paddock/types"

/**
 * Recharts pinta SVG e nao aceita classe do Tailwind, entao a cor precisa ser
 * um valor. Em vez de cravar hex (que congela o tema escuro), le o token do
 * design system em runtime — assim o grafico acompanha claro/escuro sozinho.
 */
function useThemeTokens() {
  const [t, setT] = useState({
    accent: "", neutral: "", ink: "", inkMuted: "", rule: "", surface: "",
  })
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement)
      const v = (name: string) => `hsl(${cs.getPropertyValue(name).trim()})`
      setT({
        accent: v("--primary"),
        neutral: v("--accent"), // aco escovado — meses passados recuam
        ink: v("--foreground"),
        inkMuted: v("--muted-foreground"),
        rule: v("--border"),
        surface: v("--popover"),
      })
    }
    read()
    // o toggle de tema troca a classe do <html>
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => mo.disconnect()
  }, [])
  return t
}

interface Props {
  data: BillingMonthPoint[]
}

export function BillingByTypeChart({ data }: Props) {
  const { accent: ACCENT, neutral: NEUTRAL, ink: INK, inkMuted: INK_MUTED, rule: RULE, surface: SURFACE } = useThemeTokens()
  const chartData = data.map((d) => ({
    month: d.month,
    total: parseFloat(String(d.amount ?? 0)),
  }))

  const isEmpty = chartData.every((d) => d.total === 0)

  return (
    <div className="bg-muted/50 rounded-md border border-border shadow-sm p-4">
      <h3 className="text-sm font-semibold text-foreground/70 mb-4">
        Faturamento — Últimos 6 Meses
      </h3>
      {isEmpty ? (
        <div className="flex h-24 flex-col items-center justify-center gap-1.5 text-muted-foreground">
          <BarChart3 className="h-5 w-5" />
          <p className="text-xs">Sem faturamento no período</p>
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={200}>
        {/* left:8 — a margem negativa anterior cortava os rótulos do eixo Y */}
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={RULE} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: INK_MUTED }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={58}
            tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
            tick={{ fontSize: 11, fill: INK_MUTED }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: SURFACE,
              border: `1px solid ${RULE}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            itemStyle={{ color: INK }}
            labelStyle={{ color: INK_MUTED, fontWeight: 600 }}
            formatter={(value: number) => [
              value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
              "Faturamento",
            ]}
          />
          {/* Faturamento e dado, nao estado: nem vermelho de erro nem verde de
              sucesso. Os meses anteriores recuam em neutro e so o ULTIMO periodo
              da serie veste a cor de marca — um unico acento, como manda a
              Regra dos 10%, e o olho cai onde a serie termina. */}
          <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={44} name="Faturamento">
            {chartData.map((d, i) => (
              <Cell key={d.month} fill={i === chartData.length - 1 ? ACCENT : NEUTRAL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}
