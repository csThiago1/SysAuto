"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import type { ServiceOrderStatus } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ApiError } from "@/lib/api"
import { useServiceOrder } from "@/app/(app)/os/[numero]/_hooks/useServiceOrder"
import {
  useTransitionWithValidation,
  useRequestOverride,
} from "@/hooks/useTransitionValidation"
import { useWizard } from "./useWizard"
import { WizardChecklist } from "./WizardChecklist"
import { WizardFooter } from "./WizardFooter"
import { OverrideRequestModal } from "./OverrideRequestModal"
import { ManagerCredentialsModal } from "./ManagerCredentialsModal"

interface TransitionWizardProps {
  orderId: string
  target: ServiceOrderStatus
  onClose: () => void
  onSuccess: () => void
}

export function TransitionWizard({ orderId, target, onClose, onSuccess }: TransitionWizardProps) {
  const { data: order, isLoading } = useServiceOrder(orderId)
  const transitionMutation = useTransitionWithValidation(orderId)
  const overrideMutation = useRequestOverride(orderId)
  const { resolvedCodes, markResolved, reset, isAllBlockingResolved } = useWizard()

  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [managerModalOpen, setManagerModalOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const [managerEmail, setManagerEmail] = useState("")
  const [managerPassword, setManagerPassword] = useState("")

  const validation = order?.transition_requirements?.[target]
  const hardBlocks = validation?.hard_blocks ?? []
  const softBlocks = validation?.soft_blocks ?? []
  const warnings = validation?.warnings ?? []

  const allBlockingResolved = isAllBlockingResolved(hardBlocks, softBlocks)
  const targetLabel = SERVICE_ORDER_STATUS_CONFIG[target]?.label ?? target

  async function handleAdvance(): Promise<void> {
    try {
      await transitionMutation.mutateAsync({ new_status: target })
      toast.success(`Status atualizado para "${targetLabel}"`)
      reset()
      onSuccess()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao avançar status — tente novamente")
    }
  }

  async function handleForceWithCredentials(): Promise<void> {
    try {
      await transitionMutation.mutateAsync({
        new_status: target,
        force: true,
        manager_email: managerEmail,
        manager_password: managerPassword,
        justification: overrideReason,
      })
      toast.success(`Status atualizado para "${targetLabel}" (liberado pelo gerente)`)
      setManagerModalOpen(false)
      setOverrideModalOpen(false)
      reset()
      onSuccess()
      setManagerEmail("")
      setManagerPassword("")
      setOverrideReason("")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Credenciais inválidas ou permissão insuficiente")
    }
  }

  async function handleRequestRemoteOverride(): Promise<void> {
    if (!overrideReason.trim()) return
    try {
      await overrideMutation.mutateAsync({ target_status: target, reason: overrideReason })
      setOverrideModalOpen(false)
      setOverrideReason("")
    } catch {
      // handled by hook
    }
  }

  function handleClose(): void {
    reset()
    onClose()
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {isLoading ? "Carregando..." : `OS #${order?.number} — Avançar para ${targetLabel}`}
            </DialogTitle>
            {!isLoading && order && (
              <DialogDescription>
                Resolva as pendências abaixo para confirmar a transição.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && order && (
              <>
                <WizardChecklist
                  hardBlocks={hardBlocks}
                  softBlocks={softBlocks}
                  warnings={warnings}
                  resolvedCodes={resolvedCodes}
                  order={order}
                  onResolved={markResolved}
                />

                <WizardFooter
                  targetLabel={targetLabel}
                  allBlockingResolved={allBlockingResolved}
                  hasSoftBlocks={softBlocks.length > 0}
                  isAdvancing={transitionMutation.isPending}
                  onAdvance={() => void handleAdvance()}
                  onRequestOverride={() => setOverrideModalOpen(true)}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <OverrideRequestModal
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        orderNumber={String(order?.number ?? "")}
        currentStatusLabel={
          order?.status
            ? (SERVICE_ORDER_STATUS_CONFIG[order.status as ServiceOrderStatus]?.label ?? order.status)
            : ""
        }
        targetStatusLabel={targetLabel}
        softBlocks={softBlocks}
        reason={overrideReason}
        onReasonChange={setOverrideReason}
        isSubmittingRemote={overrideMutation.isPending}
        onManagerPresentClick={() => {
          if (!overrideReason.trim()) {
            toast.error("Preencha o motivo da solicitação")
            return
          }
          setManagerModalOpen(true)
        }}
        onRemoteSubmit={() => void handleRequestRemoteOverride()}
      />

      <ManagerCredentialsModal
        open={managerModalOpen}
        onOpenChange={setManagerModalOpen}
        email={managerEmail}
        onEmailChange={setManagerEmail}
        password={managerPassword}
        onPasswordChange={setManagerPassword}
        isAuthorizing={transitionMutation.isPending}
        onAuthorize={() => void handleForceWithCredentials()}
      />
    </>
  )
}
