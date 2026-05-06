"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Car,
  CheckCircle2,
  DollarSign,
  FileText,
  Loader2,
  Truck,
  XCircle,
} from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import type { ServiceOrder } from "@paddock/types"
import { formatCurrency } from "@paddock/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { BillingModal } from "../BillingModal"
import { FiscalEmissionModal } from "../FiscalEmissionModal"
import { DocumentHistorySection } from "../DocumentHistorySection"
import { DeliveryConfirmationDialog } from "./ClosingTab/DeliveryConfirmationDialog"

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClosingTabProps {
  order?: ServiceOrder
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClosingTab({ order }: ClosingTabProps) {
  const qc = useQueryClient()
  const [mileageOut, setMileageOut] = useState(order?.mileage_out?.toString() ?? "")
  const [savingKm, setSavingKm] = useState(false)
  const [showDelivery, setShowDelivery] = useState(false)
  const [showNfseModal, setShowNfseModal] = useState(false)
  const [showBillingModal, setShowBillingModal] = useState(false)

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">Salve a OS para visualizar o fechamento.</p>
      </div>
    )
  }

  const partsTotal = Number(order.parts_total)
  const servicesTotal = Number(order.services_total)
  const discountTotal = Number(order.discount_total)
  const grandTotal = partsTotal + servicesTotal - discountTotal

  const isDelivered = order.status === "delivered"
  const isCancelled = order.status === "cancelled"
  const isReady = order.status === "ready"

  async function saveMileageOut(): Promise<void> {
    const val = parseInt(mileageOut, 10)
    if (isNaN(val) || val < 0) { toast.error("KM inválido."); return }
    setSavingKm(true)
    try {
      await apiFetch(`/api/proxy/service-orders/${order!.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mileage_out: val }),
      })
      void qc.invalidateQueries({ queryKey: ["service-orders", order!.id] })
      toast.success("KM de saída registrado.")
    } catch {
      toast.error("Erro ao salvar KM.")
    } finally {
      setSavingKm(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Status banner */}
      {isDelivered && (
        <div className="flex items-center gap-3 rounded-lg bg-success-500/10 border border-success-500/20 p-4">
          <CheckCircle2 className="h-5 w-5 text-success-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-success-400">OS Entregue</p>
            {order.client_delivery_date && (
              <p className="text-xs text-success-400/70 mt-0.5">
                {format(new Date(order.client_delivery_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
        </div>
      )}
      {isCancelled && (
        <div className="flex items-center gap-3 rounded-lg bg-error-500/10 border border-error-500/20 p-4">
          <XCircle className="h-5 w-5 text-error-400 shrink-0" />
          <p className="text-sm font-semibold text-error-400">OS Cancelada</p>
        </div>
      )}

      {/* Deliver CTA — shown when ready */}
      {isReady && (
        <div className="flex items-center justify-between bg-success-500/10 border border-success-500/20 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Truck className="h-5 w-5 text-success-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success-400">Veículo pronto para entrega</p>
              <p className="text-xs text-success-400/70 mt-0.5">
                {order.customer_type === "private"
                  ? "Certifique-se de emitir a nota fiscal antes de entregar."
                  : "Confirme a entrega ao finalizar o atendimento."}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowDelivery(true)}
            className="bg-success-600 hover:bg-success-700 text-foreground shrink-0"
          >
            <Truck className="h-4 w-4 mr-1.5" />
            Registrar Entrega
          </Button>
        </div>
      )}

      {/* Financial summary */}
      <div className="bg-muted/50 border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Resumo Financeiro
          </h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-foreground/60">Peças</span>
            <span className="font-medium text-foreground">{formatCurrency(partsTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-foreground/60">Serviços / Mão de obra</span>
            <span className="font-medium text-foreground">{formatCurrency(servicesTotal)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">Descontos</span>
              <span className="font-medium text-error-400">− {formatCurrency(discountTotal)}</span>
            </div>
          )}
          <div className="border-t border-border pt-3 flex justify-between items-baseline">
            <span className="text-base font-bold text-foreground">Total</span>
            <span className="text-xl font-bold text-foreground">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* KM section */}
      <div className="bg-muted/50 border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
          <Car className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Quilometragem
          </h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">KM de Entrada</Label>
              <p className="mt-1 text-sm font-medium text-foreground/70">
                {order.mileage_in != null
                  ? `${order.mileage_in.toLocaleString("pt-BR")} km`
                  : "—"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground" htmlFor="mileage-out">KM de Saída</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="mileage-out"
                  type="number"
                  min={order.mileage_in ?? 0}
                  value={mileageOut}
                  onChange={(e) => setMileageOut(e.target.value)}
                  placeholder="Ex: 85000"
                  className="h-9"
                  disabled={isDelivered}
                />
                <Button
                  size="sm"
                  onClick={saveMileageOut}
                  disabled={savingKm || !mileageOut || isDelivered}
                  className="shrink-0"
                >
                  {savingKm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fiscal */}
      <div className="bg-muted/50 border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Fiscal</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2
              className={cn("h-5 w-5", order.invoice_issued ? "text-success-400" : "text-muted-foreground")}
            />
            <span className={cn("text-sm font-medium", order.invoice_issued ? "text-success-400" : "text-muted-foreground")}>
              {order.invoice_issued ? "Nota fiscal emitida" : "Nota fiscal não emitida"}
            </span>
          </div>
          {order.nfe_key && (
            <div>
              <Label className="text-xs text-muted-foreground">Chave NF-e</Label>
              <p className="mt-0.5 font-mono text-xs text-foreground/70 break-all bg-muted/30 rounded px-2 py-1.5">
                {order.nfe_key}
              </p>
            </div>
          )}
          {order.nfse_number && (
            <div>
              <Label className="text-xs text-muted-foreground">Número NFS-e</Label>
              <p className="mt-0.5 text-sm font-medium text-foreground/70">{order.nfse_number}</p>
            </div>
          )}
          {!order.invoice_issued && order.customer_type === "private" && !isCancelled && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              OS de cliente particular — nota fiscal obrigatória ao entregar.
            </p>
          )}
          {!order.invoice_issued && (
            <Button
              onClick={() => setShowBillingModal(true)}
              className="gap-1.5 bg-success-600 hover:bg-success-700 text-foreground"
            >
              <DollarSign className="h-4 w-4" />
              Faturar OS
            </Button>
          )}
        </div>
      </div>

      {/* Generated documents */}
      <DocumentHistorySection order={order} />

      {/* Delivery dialog */}
      {showDelivery && (
        <DeliveryConfirmationDialog
          order={order}
          onClose={() => setShowDelivery(false)}
          onSuccess={() => {
            setShowDelivery(false)
            void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
          }}
        />
      )}

      {/* Fiscal emission modal (NFS-e / NF-e) */}
      {showNfseModal && (
        <FiscalEmissionModal
          serviceOrderId={order.id}
          orderNumber={order.number}
          hasParts={partsTotal > 0}
          onClose={() => setShowNfseModal(false)}
          onSuccess={() => {
            setShowNfseModal(false)
            void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
          }}
        />
      )}

      {/* Billing modal */}
      <BillingModal
        open={showBillingModal}
        onOpenChange={setShowBillingModal}
        order={order}
      />
    </div>
  )
}
