"use client"

import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, Check, Loader2, Trash2 } from "lucide-react"
import { apiFetch, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ReconcileItem {
  index: number
  item_type: "PART" | "SERVICE" | "EXTERNAL_SERVICE" | string
  description: string
  external_code: string
  part_type: string
  supplier: "OFICINA" | "SEGURADORA" | string
  quantity: string
  unit_price: string
  discount_pct: string
  net_price: string
  flag_inclusao_manual?: boolean
}

export interface ReconcileTotals {
  parser_parts: string
  parser_services: string
  parser_grand_total: string
  source_parts: string
  source_services: string
  source_grand_total: string
  parts_diff: string
  services_diff: string
  grand_diff: string
  needs_reconciliation: boolean
}

export interface ReconcilePayload {
  action: "reconcile" | "still_diverged"
  import_attempt_id: number | string
  totals: ReconcileTotals
  items: ReconcileItem[]
  message?: string
}

interface Props {
  orderId: string
  payload: ReconcilePayload
  open: boolean
  onClose: () => void
  onApplied: () => void
}

const TOLERANCE = 0.10

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseDec(s: string): number {
  const n = parseFloat(s.replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

export function ImportReconcileModal({ orderId, payload, open, onClose, onApplied }: Props) {
  const queryClient = useQueryClient()
  const [items, setItems] = useState<ReconcileItem[]>(payload.items)
  const sourceParts = parseDec(payload.totals.source_parts)
  const sourceServices = parseDec(payload.totals.source_services)
  const sourceGrandTotal = parseDec(payload.totals.source_grand_total)

  // Cálculos derivados do estado atual de items
  const derived = useMemo(() => {
    let parts = 0
    let services = 0
    items.forEach((it) => {
      const net = parseDec(it.net_price)
      if (it.item_type === "PART") parts += net
      else services += net
    })
    const partsDiff = parts - sourceParts
    const servicesDiff = services - sourceServices
    const grandDiff = (parts + services) - sourceGrandTotal
    return {
      parts, services, total: parts + services,
      partsDiff, servicesDiff, grandDiff,
      canApply:
        Math.abs(partsDiff) <= TOLERANCE
        && Math.abs(servicesDiff) <= TOLERANCE
        && Math.abs(grandDiff) <= TOLERANCE,
    }
  }, [items, sourceParts, sourceServices, sourceGrandTotal])

  function updateItem(idx: number, field: keyof ReconcileItem, value: string): void {
    setItems((prev) => {
      const next = [...prev]
      const it = { ...next[idx], [field]: value }
      // Auto-recalc net_price quando muda qty ou unit_price
      if (field === "quantity" || field === "unit_price") {
        const qty = parseDec(field === "quantity" ? value : it.quantity)
        const unit = parseDec(field === "unit_price" ? value : it.unit_price)
        const disc = parseDec(it.discount_pct)
        const net = qty * unit * (1 - disc / 100)
        it.net_price = net.toFixed(2)
      }
      next[idx] = it
      return next
    })
  }

  function removeItem(idx: number): void {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addItem(item_type: "PART" | "SERVICE"): void {
    setItems((prev) => [
      ...prev,
      {
        index: -1,
        item_type,
        description: "",
        external_code: "",
        part_type: item_type === "PART" ? "" : "Serviço",
        supplier: "OFICINA",
        quantity: "1.00",
        unit_price: "0.00",
        discount_pct: "0.00",
        net_price: "0.00",
      },
    ])
  }

  function autoAdjust(category: "PART" | "SERVICE"): void {
    // Adiciona item "Ajuste" pra zerar diff
    const diff = category === "PART" ? derived.partsDiff : derived.servicesDiff
    if (Math.abs(diff) <= TOLERANCE) return
    const adjustValue = -diff  // negativo se parser está acima da fonte
    setItems((prev) => [
      ...prev,
      {
        index: -1,
        item_type: category,
        description: `Ajuste ${category === "PART" ? "peças" : "serviços"} (conciliação)`,
        external_code: "ADJ",
        part_type: category === "PART" ? "" : "Ajuste",
        supplier: "OFICINA",
        quantity: "1.00",
        unit_price: adjustValue.toFixed(2),
        discount_pct: "0.00",
        net_price: adjustValue.toFixed(2),
      },
    ])
  }

  const applyMutation = useMutation({
    mutationFn: async () =>
      apiFetch(
        `/api/proxy/service-orders/${orderId}/import-budget/reconcile/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            import_attempt_id: payload.import_attempt_id,
            items: items.map((it) => ({
              item_type: it.item_type,
              description: it.description,
              external_code: it.external_code,
              part_type: it.part_type,
              supplier: it.supplier,
              quantity: it.quantity,
              unit_price: it.unit_price,
              discount_pct: it.discount_pct,
              net_price: it.net_price,
            })),
          }),
        },
      ),
    onSuccess: () => {
      toast.success("Orçamento conciliado e aplicado na OS")
      queryClient.invalidateQueries({ queryKey: ["service-order", orderId] })
      onApplied()
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Erro ao aplicar conciliação."
      toast.error(message)
    },
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-500" />
            Conciliação Obrigatória
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            O total do orçamento da seguradora não bate com a soma dos itens importados.
            Revise abaixo antes de aplicar.
          </p>
        </DialogHeader>

        {/* Cards de totais */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <CategoryCard
            label="Peças"
            parser={derived.parts}
            source={sourceParts}
            diff={derived.partsDiff}
            onAutoAdjust={() => autoAdjust("PART")}
          />
          <CategoryCard
            label="Serviços"
            parser={derived.services}
            source={sourceServices}
            diff={derived.servicesDiff}
            onAutoAdjust={() => autoAdjust("SERVICE")}
          />
          <CategoryCard
            label="Total"
            parser={derived.total}
            source={sourceGrandTotal}
            diff={derived.grandDiff}
            isGrandTotal
          />
        </div>

        {/* Tabela editável */}
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="px-2 py-2 text-left w-16">Tipo</th>
                <th className="px-2 py-2 text-left">Descrição</th>
                <th className="px-2 py-2 text-left w-20">Cód.</th>
                <th className="px-2 py-2 text-left w-24">Fornec.</th>
                <th className="px-2 py-2 text-right w-20">Qtd</th>
                <th className="px-2 py-2 text-right w-28">Unit. (R$)</th>
                <th className="px-2 py-2 text-right w-20">Desc. %</th>
                <th className="px-2 py-2 text-right w-28">Total (R$)</th>
                <th className="px-2 py-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={`${it.index}-${idx}`} className="border-t hover:bg-muted/40">
                  <td className="px-2 py-1">
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      it.item_type === "PART" ? "bg-info-500/10 text-info-500" : "bg-success-500/10 text-success-600",
                    )}>
                      {it.item_type === "PART" ? "Peça" : "Serv."}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      value={it.description}
                      onChange={(e) => updateItem(idx, "description", e.target.value)}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      value={it.external_code}
                      onChange={(e) => updateItem(idx, "external_code", e.target.value)}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1 text-xs">{it.supplier === "SEGURADORA" ? "Segurad." : "Oficina"}</td>
                  <td className="px-2 py-1">
                    <Input
                      type="number" step="0.01"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      className="h-7 text-xs text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number" step="0.01"
                      value={it.unit_price}
                      onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                      className="h-7 text-xs text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number" step="0.01"
                      value={it.discount_pct}
                      onChange={(e) => updateItem(idx, "discount_pct", e.target.value)}
                      className="h-7 text-xs text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      type="number" step="0.01"
                      value={it.net_price}
                      onChange={(e) => updateItem(idx, "net_price", e.target.value)}
                      className="h-7 text-xs text-right font-semibold"
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-error-500 hover:text-error-700"
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => addItem("PART")}>
            + Adicionar peça
          </Button>
          <Button variant="outline" size="sm" onClick={() => addItem("SERVICE")}>
            + Adicionar serviço
          </Button>
        </div>

        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <div className="text-sm">
            {derived.canApply ? (
              <span className="flex items-center gap-1 text-success-600 font-semibold">
                <Check className="h-4 w-4" /> Total conciliado — pronto para aplicar
              </span>
            ) : (
              <span className="text-error-600 text-xs">
                Diff total: R$ {formatBRL(derived.grandDiff)} — ajuste pra ≤ R$ {TOLERANCE.toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={applyMutation.isPending}>
              Cancelar
            </Button>
            <Button
              disabled={!derived.canApply || applyMutation.isPending}
              onClick={() => applyMutation.mutate()}
            >
              {applyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Aplicar na OS
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface CardProps {
  label: string
  parser: number
  source: number
  diff: number
  isGrandTotal?: boolean
  onAutoAdjust?: () => void
}

function CategoryCard({ label, parser, source, diff, isGrandTotal, onAutoAdjust }: CardProps) {
  const ok = Math.abs(diff) <= TOLERANCE
  return (
    <div className={cn(
      "rounded-lg border p-3",
      ok ? "border-success-500/30 bg-success-500/5" : "border-error-500/30 bg-error-500/5",
    )}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xs flex justify-between">
        <span className="text-muted-foreground">Importado</span>
        <span className="font-semibold">R$ {formatBRL(parser)}</span>
      </div>
      <div className="text-xs flex justify-between">
        <span className="text-muted-foreground">Seguradora</span>
        <span className="font-semibold">R$ {formatBRL(source)}</span>
      </div>
      <div className={cn(
        "mt-1 text-sm font-bold flex justify-between border-t pt-1",
        ok ? "text-success-600" : "text-error-600",
      )}>
        <span>Diff</span>
        <span>R$ {diff >= 0 ? "+" : ""}{formatBRL(diff)}</span>
      </div>
      {!ok && !isGrandTotal && onAutoAdjust && (
        <button
          onClick={onAutoAdjust}
          className="mt-2 w-full text-[10px] uppercase tracking-wide rounded border border-warning-500/40 px-2 py-1 text-warning-600 hover:bg-warning-500/10"
        >
          + Linha de ajuste
        </button>
      )}
    </div>
  )
}
