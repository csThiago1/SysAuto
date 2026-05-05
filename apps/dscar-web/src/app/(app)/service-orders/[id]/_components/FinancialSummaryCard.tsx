"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { FinancialSummary } from "@paddock/types"

interface Props {
  orderId: string
  customerType: string
}

export function FinancialSummaryCard({ orderId, customerType }: Props) {
  const { data: summary } = useQuery({
    queryKey: ["financial-summary", orderId],
    queryFn: () => apiFetch<FinancialSummary>(
      `/api/proxy/service-orders/${orderId}/financial-summary/`,
    ),
    enabled: customerType === "insurer",
  })

  if (!summary || customerType !== "insurer") return null

  const fmt = (v: string) =>
    parseFloat(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  return (
    <div className="space-y-3">
      {/* Seguradora */}
      <div className="rounded-lg border border-info-500/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-info-500">Seguradora</span>
          {summary.active_version && (
            <span className="rounded-full bg-info-500/15 px-2 py-0.5 text-[11px] text-info-500">
              v{summary.active_version.version_number}
            </span>
          )}
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-white/50">Peças</span><span className="text-white">{fmt(summary.insurer_parts)}</span></div>
          <div className="flex justify-between"><span className="text-white/50">Mão de obra</span><span className="text-white">{fmt(summary.insurer_labor)}</span></div>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
            <span className="font-semibold text-white">Subtotal</span>
            <span className="font-bold text-info-500">{fmt(summary.insurer_subtotal)}</span>
          </div>
          <div className="flex justify-between"><span className="text-warning-500">Franquia</span><span className="text-warning-500">- {fmt(summary.deductible)}</span></div>
        </div>
      </div>

      {/* Complemento */}
      {parseFloat(summary.complement_subtotal) > 0 && (
        <div className="rounded-lg border border-warning-500/20 p-4">
          <div className="mb-3 text-sm font-semibold text-warning-500">Complemento Particular</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-white/50">Serviços</span><span className="text-white">{fmt(summary.complement_labor)}</span></div>
            <div className="flex justify-between"><span className="text-white/50">Peças</span><span className="text-white">{fmt(summary.complement_parts)}</span></div>
            <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
              <span className="font-semibold text-white">Subtotal</span>
              <span className="font-bold text-warning-500">{fmt(summary.complement_subtotal)}</span>
            </div>
            <div className="flex justify-between"><span className="text-success-500">Já faturado</span><span className="text-success-500">{fmt(summary.complement_billed)}</span></div>
          </div>
        </div>
      )}

      {/* Totais */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs">
        <div className="flex justify-between"><span className="text-white/50">Cliente deve</span><span className="font-bold text-error-500">{fmt(summary.customer_owes)}</span></div>
        <div className="flex justify-between"><span className="text-white/50">Seguradora deve</span><span className="font-bold text-info-500">{fmt(summary.insurer_owes)}</span></div>
        <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
          <span className="font-bold text-white">Total geral</span>
          <span className="text-base font-bold text-white">{fmt(summary.grand_total)}</span>
        </div>
      </div>
    </div>
  )
}
