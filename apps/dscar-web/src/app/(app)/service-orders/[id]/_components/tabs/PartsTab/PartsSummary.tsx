"use client"

import { formatCurrency } from "@paddock/utils"
import type { ServiceOrderPart } from "@paddock/types"

// ─── Calculation helpers ─────────────────────────────────────────────────────

export function calcPartsTotals(parts: ServiceOrderPart[]): {
  custoTotal: number
  valorCobrado: number
  margemPct: number
  pendingCount: number
} {
  const pendingCount = parts.filter(
    (p) => p.status_peca !== "recebida" && p.status_peca !== "instalada"
  ).length

  const custoTotal = parts.reduce((acc, p) => {
    return acc + (p.custo_real ? parseFloat(p.custo_real) * parseFloat(p.quantity) : 0)
  }, 0)

  const valorCobrado = parts.reduce(
    (acc, p) => acc + parseFloat(p.unit_price) * parseFloat(p.quantity),
    0
  )

  const margemPct =
    custoTotal > 0 ? ((valorCobrado - custoTotal) / custoTotal) * 100 : 0

  return { custoTotal, valorCobrado, margemPct, pendingCount }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PartsSummaryProps {
  custoTotal: number
  valorCobrado: number
  margemPct: number
  pendingCount: number
  isManager: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PartsSummary({
  custoTotal,
  valorCobrado,
  margemPct,
  pendingCount,
  isManager,
}: PartsSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Custo Total - MANAGER+ only */}
      {isManager && (
        <div className="bg-muted/30 border border-border rounded-lg p-3">
          <span className="label-mono">Custo Total</span>
          <p className="text-xl font-bold font-mono text-foreground mt-1">
            {formatCurrency(custoTotal)}
          </p>
        </div>
      )}

      {/* Valor Cobrado */}
      <div className="bg-muted/30 border border-border rounded-lg p-3">
        <span className="label-mono">Valor Cobrado</span>
        <p className="text-xl font-bold font-mono text-foreground mt-1">
          {formatCurrency(valorCobrado)}
        </p>
      </div>

      {/* Margem - MANAGER+ only */}
      {isManager && (
        <div className="bg-muted/30 border border-border rounded-lg p-3">
          <span className="label-mono">Margem</span>
          <p
            className={`text-xl font-bold font-mono mt-1 ${
              margemPct > 0
                ? "text-success-400"
                : margemPct < 0
                ? "text-error-400"
                : "text-foreground"
            }`}
          >
            {margemPct.toFixed(1)}%
          </p>
        </div>
      )}

      {/* Pendentes */}
      <div
        className={`bg-muted/30 border rounded-lg p-3 ${
          pendingCount > 0 ? "border-warning-500/20" : "border-border"
        }`}
      >
        <span className="label-mono">Pendentes</span>
        <p
          className={`text-xl font-bold font-mono mt-1 ${
            pendingCount > 0 ? "text-warning-400" : "text-foreground"
          }`}
        >
          {pendingCount}
        </p>
      </div>
    </div>
  )
}
