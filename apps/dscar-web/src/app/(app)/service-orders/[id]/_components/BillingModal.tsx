"use client"

/**
 * BillingModal — faturamento de OS com breakdown e emissao de titulos
 *
 * Uso:
 *   <BillingModal
 *     order={order}
 *     open={showBilling}
 *     onOpenChange={setShowBilling}
 *   />
 */

import { useState, useEffect, useCallback } from "react"
import { DollarSign, Loader2, AlertTriangle, FileText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useBillingPreview, useBillOS } from "../_hooks/useBilling"
import type {
  ServiceOrder,
  BillingPreviewItem,
  PaymentMethod,
  BillingItemPayload,
} from "@paddock/types"
import { PAYMENT_METHOD_LABELS, PAYMENT_TERMS } from "@paddock/types"

function formatBRL(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "R$ 0,00"
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

interface ItemLocalState {
  payment_method: PaymentMethod
  payment_term_days: number
}

interface BillingModalProps {
  order: ServiceOrder
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BillingModal({ order, open, onOpenChange }: BillingModalProps) {
  const { data: preview, isLoading, error: previewError } = useBillingPreview(
    open ? order.id : ""
  )
  const billMutation = useBillOS(order.id)

  const [itemStates, setItemStates] = useState<ItemLocalState[]>([])

  // Sync local state when preview loads
  useEffect(() => {
    if (preview?.items) {
      setItemStates(
        preview.items.map((item) => ({
          payment_method: item.default_payment_method,
          payment_term_days: item.default_payment_term_days,
        }))
      )
    }
  }, [preview])

  const updateItem = useCallback(
    (index: number, field: keyof ItemLocalState, value: PaymentMethod | number) => {
      setItemStates((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: value }
        return next
      })
    },
    []
  )

  function handleConfirm() {
    if (!preview) return

    const items: BillingItemPayload[] = preview.items
      .map((item, i) => ({
        recipient_type: item.recipient_type,
        category: item.category,
        amount: item.amount,
        payment_method: itemStates[i]?.payment_method ?? item.default_payment_method,
        payment_term_days:
          itemStates[i]?.payment_term_days ?? item.default_payment_term_days,
      }))
      .filter((item) => parseFloat(item.amount) > 0)

    if (items.length === 0) {
      toast.error("Nenhum item com valor para faturar.")
      return
    }

    billMutation.mutate(
      { items },
      {
        onSuccess: (result) => {
          toast.success(
            `Faturamento concluido: ${result.summary.receivables_count} titulo(s) e ${result.summary.fiscal_docs_count} NF(s) gerados.`
          )
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(
            err.message || "Erro ao faturar OS. Tente novamente."
          )
        },
      }
    )
  }

  const vehicleLabel = [order.make, order.model].filter(Boolean).join(" ")
  const plateLabel = order.plate ? `(${order.plate})` : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-white">
            <DollarSign className="h-5 w-5 text-success-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                Faturamento — OS #{order.number}
              </p>
              <p className="text-xs text-white/50 font-normal truncate">
                {order.make_logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={order.make_logo}
                    alt=""
                    className="inline-block h-3.5 w-3.5 mr-1 align-text-bottom"
                  />
                )}
                {vehicleLabel} {plateLabel}
                {order.customer_name && ` — ${order.customer_name}`}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-white/40">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando preview...
            </div>
          )}

          {/* Error */}
          {previewError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-950/50 border border-red-700/40 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">
                Erro ao carregar preview de faturamento.
              </p>
            </div>
          )}

          {/* Preview loaded */}
          {preview && (
            <>
              {/* RESUMO */}
              <div>
                <p className="label-mono text-white/40 mb-2">RESUMO</p>
                <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3 space-y-1.5">
                  <SummaryRow label="Pecas" value={preview.parts_total} />
                  <SummaryRow label="Servicos" value={preview.services_total} />
                  <SummaryRow
                    label="Descontos"
                    value={preview.discount_total}
                    negative
                  />
                  <div className="border-t border-white/10 my-1.5" />
                  <SummaryRow
                    label="Total"
                    value={preview.grand_total}
                    bold
                  />
                  {parseFloat(preview.deductible_amount) > 0 && (
                    <SummaryRow
                      label="Franquia"
                      value={preview.deductible_amount}
                    />
                  )}
                </div>
              </div>

              {/* TITULOS A GERAR */}
              <div>
                <p className="label-mono text-white/40 mb-2">
                  TITULOS A GERAR
                </p>
                <div className="space-y-2">
                  {preview.items.map((item, i) => {
                    const amount = parseFloat(item.amount)
                    const isZero = isNaN(amount) || amount === 0
                    const localState = itemStates[i]

                    return (
                      <div
                        key={`${item.recipient_type}-${item.category}`}
                        className={`rounded-lg bg-white/[0.03] border border-white/10 p-3 space-y-2.5 ${
                          isZero ? "opacity-50" : ""
                        }`}
                      >
                        {/* Item header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 text-white/30 shrink-0" />
                            <span className="text-sm text-white/80 truncate">
                              {item.label}
                            </span>
                          </div>
                          <span className="font-mono text-sm text-white/90 shrink-0 ml-2">
                            {formatBRL(item.amount)}
                          </span>
                        </div>

                        {isZero ? (
                          <p className="text-xs text-white/30 flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3" />
                            Valor zerado — nao sera gerado titulo
                          </p>
                        ) : (
                          localState && (
                            <div className="flex gap-2">
                              {/* Payment method */}
                              <div className="flex-1 min-w-0">
                                <label className="label-mono text-white/40 text-[9px] mb-1 block">
                                  FORMA PGTO
                                </label>
                                <select
                                  value={localState.payment_method}
                                  onChange={(e) =>
                                    updateItem(
                                      i,
                                      "payment_method",
                                      e.target.value as PaymentMethod
                                    )
                                  }
                                  className="w-full h-8 rounded border border-white/10 bg-white/[0.04] text-xs text-white/80 px-2 focus:outline-none focus:border-white/20 transition-colors"
                                >
                                  {(
                                    Object.entries(PAYMENT_METHOD_LABELS) as [
                                      PaymentMethod,
                                      string,
                                    ][]
                                  ).map(([key, label]) => (
                                    <option key={key} value={key}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Payment term */}
                              <div className="flex-1 min-w-0">
                                <label className="label-mono text-white/40 text-[9px] mb-1 block">
                                  PRAZO
                                </label>
                                <select
                                  value={localState.payment_term_days}
                                  onChange={(e) =>
                                    updateItem(
                                      i,
                                      "payment_term_days",
                                      parseInt(e.target.value, 10)
                                    )
                                  }
                                  className="w-full h-8 rounded border border-white/10 bg-white/[0.04] text-xs text-white/80 px-2 focus:outline-none focus:border-white/20 transition-colors"
                                >
                                  {PAYMENT_TERMS.map((term) => (
                                    <option key={term.days} value={term.days}>
                                      {term.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )
                        )}

                        {item.note && (
                          <p className="text-xs text-white/40 italic">
                            {item.note}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer info */}
              <p className="text-xs text-white/30 flex items-start gap-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Notas fiscais serao emitidas automaticamente apos a confirmacao
                do faturamento.
              </p>

              {/* Can't bill warning */}
              {!preview.can_bill && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-950/30 border border-amber-700/20 px-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-300/80">
                    Esta OS nao pode ser faturada no momento. Verifique se o
                    status permite faturamento.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {preview && (
          <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-white/60"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                billMutation.isPending || !preview.can_bill
              }
              className="bg-success-600 hover:bg-success-700 text-white"
            >
              {billMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Faturando...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-1.5" />
                  Faturar e Emitir NF
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function SummaryRow({
  label,
  value,
  bold = false,
  negative = false,
}: {
  label: string
  value: string
  bold?: boolean
  negative?: boolean
}) {
  const amount = parseFloat(value)
  const displayValue = negative && amount > 0 ? `-${formatBRL(value)}` : formatBRL(value)

  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${bold ? "text-white/80 font-medium" : "text-white/50"}`}>
        {label}
      </span>
      <span
        className={`font-mono text-xs ${
          bold
            ? "text-white font-semibold"
            : negative
              ? "text-red-400/80"
              : "text-white/70"
        }`}
      >
        {displayValue}
      </span>
    </div>
  )
}
