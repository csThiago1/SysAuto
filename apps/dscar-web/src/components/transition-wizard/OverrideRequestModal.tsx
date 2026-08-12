"use client"

import { Loader2, Lock } from "lucide-react"
import type { ValidationBlock } from "@paddock/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface OverrideRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderNumber: string
  currentStatusLabel: string
  targetStatusLabel: string
  softBlocks: ValidationBlock[]
  reason: string
  onReasonChange: (next: string) => void
  isSubmittingRemote: boolean
  onManagerPresentClick: () => void
  onRemoteSubmit: () => void
}

/**
 * Modal de solicitação de override do gerente.
 *
 * Mostra a lista de soft blocks pendentes, um textarea pro motivo e dois
 * caminhos: "Gerente presente" (abre o ManagerCredentialsModal) ou
 * "Aprovação remota" (dispara POST /override-request/).
 *
 * Componente controlled — o reason e o estado de submissão remota moram no
 * parent pra continuar refletindo o ciclo de vida da OS.
 */
export function OverrideRequestModal({
  open,
  onOpenChange,
  orderNumber,
  currentStatusLabel,
  targetStatusLabel,
  softBlocks,
  reason,
  onReasonChange,
  isSubmittingRemote,
  onManagerPresentClick,
  onRemoteSubmit,
}: OverrideRequestModalProps) {
  const reasonFilled = reason.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Liberação — OS #{orderNumber}</DialogTitle>
          <DialogDescription>
            Transição: {currentStatusLabel} → {targetStatusLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-2">Bloqueios pendentes:</p>
            <ul className="space-y-1">
              {softBlocks.map((b) => (
                <li
                  key={b.code}
                  className="flex items-start gap-2 text-sm text-warning-400"
                >
                  <Lock className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                  {b.message}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="override-reason" className="text-sm font-medium">
              Motivo da solicitação{" "}
              <span className="text-error-400" aria-hidden="true">*</span>
            </label>
            <textarea
              id="override-reason"
              aria-required="true"
              aria-label="Motivo da solicitação"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
              placeholder="Explique por que a transição deve ser liberada..."
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Como liberar:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={onManagerPresentClick}>
                Gerente presente
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!reasonFilled || isSubmittingRemote}
                onClick={onRemoteSubmit}
              >
                {isSubmittingRemote ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
                ) : null}
                Aprovação remota
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
