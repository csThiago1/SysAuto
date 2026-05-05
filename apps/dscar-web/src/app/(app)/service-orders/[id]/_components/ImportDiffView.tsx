"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ImportBudgetResponse, VersionDiffItem } from "@paddock/types"

const CHANGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  added: { bg: "bg-success-500/10", text: "text-success-500", label: "+ Novo" },
  removed: { bg: "bg-error-500/10", text: "text-error-500", label: "Removido" },
  changed: { bg: "bg-warning-500/10", text: "text-warning-500", label: "Alterado" },
  unchanged: { bg: "", text: "text-white/40", label: "—" },
}

interface Props {
  diffResult: ImportBudgetResponse
  onApply: () => void
  onCancel: () => void
  isApplying: boolean
}

export function ImportDiffView({ diffResult, onApply, onCancel, isApplying }: Props) {
  const { current_version, new_version, diff_items, totals_diff } = diffResult
  if (!current_version || !new_version || !diff_items || !totals_diff) return null

  const difference = parseFloat(totals_diff.difference)

  const fmtMoney = (v: string | number) =>
    parseFloat(String(v)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Nova Versão Encontrada — v{new_version.version_number}
      </h2>

      {/* Summary cards */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-surface-800 p-3">
          <div className="text-[11px] uppercase text-white/40">Versão Atual</div>
          <div className="text-xl font-bold text-white/60">v{current_version.version_number}</div>
        </div>
        <div className="rounded-lg border border-info-500/30 bg-info-500/10 p-3">
          <div className="text-[11px] uppercase text-info-500">Nova Versão</div>
          <div className="text-xl font-bold text-info-500">v{new_version.version_number}</div>
        </div>
        <div className="rounded-lg bg-surface-800 p-3">
          <div className="text-[11px] uppercase text-white/40">Total Anterior</div>
          <div className="text-xl font-bold text-white">R$ {fmtMoney(totals_diff.old_total)}</div>
        </div>
        <div className="rounded-lg bg-surface-800 p-3">
          <div className="text-[11px] uppercase text-white/40">Novo Total</div>
          <div className={cn("text-xl font-bold", difference >= 0 ? "text-success-500" : "text-error-500")}>
            R$ {fmtMoney(totals_diff.new_total)}
          </div>
          <div className={cn("text-[11px]", difference >= 0 ? "text-success-500" : "text-error-500")}>
            {difference >= 0 ? "+" : ""}R$ {fmtMoney(difference)}
          </div>
        </div>
      </div>

      {/* Diff table */}
      <div className="mb-5 overflow-hidden rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-800">
              <th className="px-3 py-2 text-left font-semibold text-white/60">Item</th>
              <th className="px-3 py-2 text-center font-semibold text-white/60">Tipo</th>
              <th className="px-3 py-2 text-right font-semibold text-white/60">Anterior</th>
              <th className="px-3 py-2 text-right font-semibold text-white/60">Novo</th>
              <th className="px-3 py-2 text-center font-semibold text-white/60">Alteração</th>
            </tr>
          </thead>
          <tbody>
            {diff_items.map((item: VersionDiffItem, i: number) => {
              const style = CHANGE_STYLES[item.change_type]
              return (
                <tr key={i} className={cn("border-t border-white/5", style.bg)}>
                  <td className={cn("px-3 py-2", item.change_type === "removed" ? "line-through text-error-500" : "text-white")}>
                    {item.description}
                    {item.is_executed && (
                      <span className="ml-2 rounded bg-warning-500/15 px-1.5 py-0.5 text-[10px] text-warning-500">Executado</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn("rounded px-2 py-0.5 text-[11px]",
                      item.item_type === "PART" ? "bg-info-900/50 text-info-400" : "bg-warning-900/50 text-warning-400",
                    )}>{item.item_type === "PART" ? "Peça" : "MO"}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-white/60">
                    {item.old_value ? `R$ ${fmtMoney(item.old_value)}` : "—"}
                  </td>
                  <td className={cn("px-3 py-2 text-right", style.text)}>
                    {item.new_value ? `R$ ${fmtMoney(item.new_value)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn("rounded px-2 py-0.5 text-[11px]", `${style.bg} ${style.text}`)}>{style.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Executed items warning */}
      {diff_items.some((i: VersionDiffItem) => i.is_executed) && (
        <div className="mb-5 flex gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 p-3 text-xs text-warning-400">
          <span>⚠</span>
          <span>
            <strong>{diff_items.filter((i: VersionDiffItem) => i.is_executed).length} itens já executados</strong>{" "}
            serão preservados independente do override.
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5">
          Cancelar
        </button>
        <button type="button" disabled={isApplying} onClick={onApply}
          className="inline-flex items-center gap-2 rounded-md bg-info-600 px-4 py-2 text-sm font-semibold text-white hover:bg-info-700 disabled:opacity-50">
          {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Aplicar Versão v{new_version.version_number}
        </button>
      </div>
    </div>
  )
}
