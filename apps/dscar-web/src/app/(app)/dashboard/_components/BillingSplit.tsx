"use client"

import { formatCurrency } from "@paddock/utils"

/**
 * Origem do faturamento do mês — seguradora vs. particular.
 *
 * O backend já mandava `billing_by_type` e a UI descartava. É a divisão que
 * define a operação da DS Car (~50/50 por sinistro e particular), e nenhum
 * ERP genérico tem esse eixo — por isso ela vem antes da tendência.
 *
 * Cores herdadas da convenção que o PartsTab já usa: seguradora = info (azul),
 * particular = warning (âmbar). Par validado para daltonismo e contraste.
 */

// Classes do design system em vez de hex: a barra e o marcador acompanham
// o tema sozinhos. O par foi validado para daltonismo e contraste.
const SEGURADORA = "bg-info-500"
const PARTICULAR = "bg-warning-600"

interface Props {
  insurer: string
  private: string
}

export function BillingSplit({ insurer, private: privateAmount }: Props) {
  const seg = parseFloat(insurer || "0")
  const part = parseFloat(privateAmount || "0")
  const total = seg + part

  // Sem faturamento o KPI já diz R$ 0,00 — uma barra vazia não acrescenta nada.
  if (total <= 0) return null

  const segPct = Math.round((seg / total) * 100)
  const partPct = 100 - segPct

  return (
    <div className="rounded-xl bg-card px-3 py-2.5">
      <p className="label-mono mb-2">Origem do faturamento</p>

      {/* gap-px sobre a superfície: o vão de 1px separa os segmentos sem
          desenhar borda, igual à régua de KPIs */}
      <div
        className="flex h-2 gap-px overflow-hidden rounded-full"
        role="img"
        aria-label={`Seguradora ${segPct}%, particular ${partPct}%`}
      >
        {seg > 0 && (
          <span className={SEGURADORA} style={{ width: `${segPct}%` }} />
        )}
        {part > 0 && (
          <span className={PARTICULAR} style={{ width: `${partPct}%` }} />
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-3">
        <Leg color={SEGURADORA} label="Seguradora" value={seg} pct={segPct} />
        <Leg color={PARTICULAR} label="Particular" value={part} pct={partPct} />
      </div>
    </div>
  )
}

function Leg({
  color,
  label,
  value,
  pct,
}: {
  /** classe de fundo do marcador (token, nao hex) */
  color: string
  label: string
  value: number
  pct: number
}) {
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-mono tabular-nums text-muted-foreground/60">
          {pct}%
        </span>
      </span>
      <span className="mt-0.5 block font-mono text-[15px] font-semibold tabular-nums text-foreground">
        {formatCurrency(value, { compact: true })}
      </span>
    </div>
  )
}
