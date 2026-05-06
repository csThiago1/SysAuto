"use client"

import { useState } from "react"
import { AlertTriangle, Loader2, Truck } from "lucide-react"

import type { ServiceOrder } from "@paddock/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDeliverOS } from "../../../_hooks/useOSItems"

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DeliveryConfirmationDialogProps {
  order: ServiceOrder
  onClose: () => void
  onSuccess: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeliveryConfirmationDialog({
  order,
  onClose,
  onSuccess,
}: DeliveryConfirmationDialogProps) {
  const deliverMutation = useDeliverOS(order.id)
  const [nfeKey, setNfeKey] = useState(order.nfe_key || "")
  const [nfseNumber, setNfseNumber] = useState(order.nfse_number || "")
  const [mileageOut, setMileageOut] = useState(order.mileage_out?.toString() ?? "")
  const [notes, setNotes] = useState("")

  const isPrivate = order.customer_type === "private"
  const hasInvoice = !!(nfeKey || nfseNumber || order.invoice_issued)
  const canDeliver = !isPrivate || hasInvoice

  function handleConfirm(): void {
    deliverMutation.mutate(
      {
        mileage_out: mileageOut ? parseInt(mileageOut, 10) : undefined,
        notes: notes || undefined,
        nfe_key: nfeKey || undefined,
        nfse_number: nfseNumber || undefined,
      },
      { onSuccess },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-muted/50 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 bg-success-500/10 border-b border-success-500/20 px-5 py-4">
          <Truck className="h-5 w-5 text-success-400 shrink-0" />
          <div>
            <p className="font-semibold text-success-400">Registrar Entrega</p>
            <p className="text-xs text-success-400/70">
              OS #{order.number} — {order.plate}
            </p>
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
                <Label htmlFor="nfe-key" className="text-xs">
                  Chave NF-e (44 dígitos)
                </Label>
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
                <Label htmlFor="nfse-num" className="text-xs">
                  Número NFS-e
                </Label>
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
            <Label htmlFor="km-out" className="text-xs">
              KM de Saída
            </Label>
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
            <Label htmlFor="delivery-notes" className="text-xs">
              Observações da entrega (opcional)
            </Label>
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
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canDeliver || deliverMutation.isPending}
            className="bg-success-600 hover:bg-success-700 text-foreground"
          >
            {deliverMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Registrando...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4 mr-1.5" /> Confirmar Entrega
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
