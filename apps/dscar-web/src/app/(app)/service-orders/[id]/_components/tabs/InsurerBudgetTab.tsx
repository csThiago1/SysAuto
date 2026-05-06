"use client"

import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import type { ServiceOrder, ServiceOrderVersion } from "@paddock/types"

interface Props {
  order: ServiceOrder
  onOpenImport: () => void
}

export function InsurerBudgetTab({ order, onOpenImport }: Props) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ["service-order-versions", order.id],
    queryFn: () => apiFetch<ServiceOrderVersion[]>(
      `/api/proxy/service-orders/versions/?service_order=${order.id}`,
    ),
  })

  const activeVersion = versions?.[0]

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  if (!activeVersion) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
        <p>Nenhum orçamento importado ainda.</p>
        <button type="button" onClick={onOpenImport}
          className="rounded-md bg-info-600 px-4 py-2 text-sm font-semibold text-foreground hover:bg-info-700">
          Importar Orçamento
        </button>
      </div>
    )
  }

  const fmtMoney = (v: string | number) =>
    parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-info-500/15 px-3 py-1 text-xs font-semibold text-info-500">
            {activeVersion.source_display} v{activeVersion.version_number}
          </span>
          <span className="text-xs text-muted-foreground">
            Importada em {new Date(activeVersion.created_at).toLocaleDateString("pt-BR")}
          </span>
          {versions && versions.length > 1 && (
            <span className="text-xs text-info-500">{versions.length - 1} versões anteriores</span>
          )}
        </div>
        <button type="button" onClick={onOpenImport}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground/60 hover:bg-muted/50">
          Verificar Nova Versão
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center justify-between bg-surface-800 px-3 py-2">
          <span className="text-xs text-muted-foreground">Itens do orçamento da seguradora (somente leitura)</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-800/50">
              <th className="px-3 py-2 text-left font-semibold text-foreground/60">Item</th>
              <th className="px-3 py-2 text-center font-semibold text-foreground/60">Tipo</th>
              <th className="px-3 py-2 text-center font-semibold text-foreground/60">Qtd</th>
              <th className="px-3 py-2 text-right font-semibold text-foreground/60">Valor</th>
            </tr>
          </thead>
          <tbody>
            {activeVersion.items.map((item) => (
              <tr key={item.id} className="border-t border-white/5">
                <td className="px-3 py-2.5 text-foreground">{item.description}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={cn("rounded px-2 py-0.5 text-[11px]",
                    item.item_type === "PART" ? "bg-info-900/50 text-info-400" : "bg-warning-900/50 text-warning-400",
                  )}>{item.item_type === "PART" ? "Peça" : "MO"}</span>
                </td>
                <td className="px-3 py-2.5 text-center text-foreground">{item.quantity}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{fmtMoney(item.net_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3">
        <div className="rounded-lg bg-surface-800 px-4 py-3 text-right">
          <div className="text-[11px] uppercase text-muted-foreground">Peças</div>
          <div className="text-base font-bold text-foreground">{fmtMoney(activeVersion.parts_total)}</div>
        </div>
        <div className="rounded-lg bg-surface-800 px-4 py-3 text-right">
          <div className="text-[11px] uppercase text-muted-foreground">Mão de Obra</div>
          <div className="text-base font-bold text-foreground">{fmtMoney(activeVersion.labor_total)}</div>
        </div>
        <div className="rounded-lg bg-surface-800 px-4 py-3 text-right">
          <div className="text-[11px] uppercase text-muted-foreground">Franquia</div>
          <div className="text-base font-bold text-warning-500">{fmtMoney(activeVersion.total_franquia)}</div>
        </div>
        <div className="rounded-lg border border-info-500/30 bg-info-500/10 px-4 py-3 text-right">
          <div className="text-[11px] uppercase text-info-500">Total Seguradora</div>
          <div className="text-lg font-bold text-info-500">{fmtMoney(activeVersion.total_seguradora)}</div>
        </div>
      </div>
    </div>
  )
}
