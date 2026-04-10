"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useDeliverOS } from "../../_hooks/useOSItems"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(value: string | number): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// ─── Delivery Confirmation Dialog ─────────────────────────────────────────────

interface DeliveryDialogProps {
  order: ServiceOrder
  onClose: () => void
  onSuccess: () => void
}

function DeliveryConfirmationDialog({ order, onClose, onSuccess }: DeliveryDialogProps) {
  const deliverMutation = useDeliverOS(order.id)
  const [nfeKey, setNfeKey] = useState(order.nfe_key || "")
  const [nfseNumber, setNfseNumber] = useState(order.nfse_number || "")
  const [mileageOut, setMileageOut] = useState(order.mileage_out?.toString() ?? "")
  const [notes, setNotes] = useState("")

  const isPrivate = order.customer_type === "private"
  const hasInvoice = !!(nfeKey || nfseNumber || order.invoice_issued)
  const canDeliver = !isPrivate || hasInvoice

  function handleConfirm() {
    deliverMutation.mutate(
      {
        mileage_out: mileageOut ? parseInt(mileageOut, 10) : undefined,
        notes: notes || undefined,
        nfe_key: nfeKey || undefined,
        nfse_number: nfseNumber || undefined,
      },
      { onSuccess }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 bg-green-50 border-b border-green-200 px-5 py-4">
          <Truck className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Registrar Entrega</p>
            <p className="text-xs text-green-600">OS #{order.number} — {order.plate}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Fiscal warning for private */}
          {isPrivate && !order.invoice_issued && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                Cliente particular — preencha NF-e ou NFS-e para habilitar a entrega.
              </p>
            </div>
          )}

          {/* NF fields */}
          {!order.invoice_issued && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nfe-key" className="text-xs">Chave NF-e (44 dígitos)</Label>
                <Input
                  id="nfe-key"
                  value={nfeKey}
                  onChange={(e) => setNfeKey(e.target.value)}
                  placeholder="00000000..."
                  maxLength={44}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label htmlFor="nfse-num" className="text-xs">Número NFS-e</Label>
                <Input
                  id="nfse-num"
                  value={nfseNumber}
                  onChange={(e) => setNfseNumber(e.target.value)}
                  placeholder="Ex: 1234"
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* KM saída */}
          <div>
            <Label htmlFor="km-out" className="text-xs">KM de Saída</Label>
            <Input
              id="km-out"
              type="number"
              value={mileageOut}
              onChange={(e) => setMileageOut(e.target.value)}
              placeholder={order.mileage_in ? `>= ${order.mileage_in}` : "Ex: 85000"}
              className="mt-1 h-8 text-xs"
              min={order.mileage_in ?? 0}
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="delivery-notes" className="text-xs">Observações da entrega (opcional)</Label>
            <Input
              id="delivery-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cliente satisfeito, veículo revisado"
              className="mt-1 h-8 text-xs"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 pb-5">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!canDeliver || deliverMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {deliverMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Registrando...</>
            ) : (
              <><Truck className="h-4 w-4 mr-1.5" /> Confirmar Entrega</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ClosingTab ──────────────────────────────────────────────────────────

interface ClosingTabProps {
  order?: ServiceOrder
}

export function ClosingTab({ order }: ClosingTabProps) {
  const qc = useQueryClient()
  const [mileageOut, setMileageOut] = useState(order?.mileage_out?.toString() ?? "")
  const [savingKm, setSavingKm] = useState(false)
  const [showDelivery, setShowDelivery] = useState(false)

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
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

  async function saveMileageOut() {
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
        <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">OS Entregue</p>
            {order.client_delivery_date && (
              <p className="text-xs text-green-600 mt-0.5">
                {format(new Date(order.client_delivery_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
        </div>
      )}
      {isCancelled && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-700">OS Cancelada</p>
        </div>
      )}

      {/* Deliver CTA — shown when ready */}
      {isReady && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Truck className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Veículo pronto para entrega</p>
              <p className="text-xs text-green-600 mt-0.5">
                {order.customer_type === "private"
                  ? "Certifique-se de emitir a nota fiscal antes de entregar."
                  : "Confirme a entrega ao finalizar o atendimento."}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowDelivery(true)}
            className="bg-green-600 hover:bg-green-700 text-white shrink-0"
          >
            <Truck className="h-4 w-4 mr-1.5" />
            Registrar Entrega
          </Button>
        </div>
      )}

      {/* Financial summary */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100 bg-neutral-50">
          <DollarSign className="h-4 w-4 text-neutral-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Resumo Financeiro
          </h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Peças</span>
            <span className="font-medium text-neutral-900">{fmtCurrency(partsTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Serviços / Mão de obra</span>
            <span className="font-medium text-neutral-900">{fmtCurrency(servicesTotal)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Descontos</span>
              <span className="font-medium text-red-600">− {fmtCurrency(discountTotal)}</span>
            </div>
          )}
          <div className="border-t border-neutral-200 pt-3 flex justify-between items-baseline">
            <span className="text-base font-bold text-neutral-900">Total</span>
            <span className="text-xl font-bold text-neutral-900">{fmtCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* KM section */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100 bg-neutral-50">
          <Car className="h-4 w-4 text-neutral-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Quilometragem
          </h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <Label className="text-xs text-neutral-500">KM de Entrada</Label>
              <p className="mt-1 text-sm font-medium text-neutral-700">
                {order.mileage_in != null
                  ? `${order.mileage_in.toLocaleString("pt-BR")} km`
                  : "—"}
              </p>
            </div>
            <div>
              <Label className="text-xs text-neutral-500" htmlFor="mileage-out">KM de Saída</Label>
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
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100 bg-neutral-50">
          <FileText className="h-4 w-4 text-neutral-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Fiscal</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2
              className={cn("h-5 w-5", order.invoice_issued ? "text-green-500" : "text-neutral-300")}
            />
            <span className={cn("text-sm font-medium", order.invoice_issued ? "text-green-700" : "text-neutral-500")}>
              {order.invoice_issued ? "Nota fiscal emitida" : "Nota fiscal não emitida"}
            </span>
          </div>
          {order.nfe_key && (
            <div>
              <Label className="text-xs text-neutral-500">Chave NF-e</Label>
              <p className="mt-0.5 font-mono text-xs text-neutral-700 break-all bg-neutral-50 rounded px-2 py-1.5">
                {order.nfe_key}
              </p>
            </div>
          )}
          {order.nfse_number && (
            <div>
              <Label className="text-xs text-neutral-500">Número NFS-e</Label>
              <p className="mt-0.5 text-sm font-medium text-neutral-700">{order.nfse_number}</p>
            </div>
          )}
          {!order.invoice_issued && order.customer_type === "private" && !isCancelled && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              OS de cliente particular — nota fiscal obrigatória ao entregar.
            </p>
          )}
        </div>
      </div>

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
    </div>
  )
}
