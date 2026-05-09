"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, AlertTriangle, Lock, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  useTransitionWithValidation,
  useRequestOverride,
} from "@/hooks/useTransitionValidation"

interface TransitionRequirementsPanelProps {
  order: ServiceOrder
  onTransitionSuccess?: () => void
}

export function TransitionRequirementsPanel({
  order,
  onTransitionSuccess,
}: TransitionRequirementsPanelProps) {
  const [selectedTarget, setSelectedTarget] = useState<ServiceOrderStatus | null>(null)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [managerModalOpen, setManagerModalOpen] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const [managerEmail, setManagerEmail] = useState("")
  const [managerPassword, setManagerPassword] = useState("")

  const transitionMutation = useTransitionWithValidation(order.id)
  const overrideMutation = useRequestOverride(order.id)

  const requirements = order.transition_requirements ?? {}
  const allowedTransitions = order.allowed_transitions ?? []

  if (allowedTransitions.length === 0) return null

  const primaryTarget = selectedTarget ?? allowedTransitions[0]
  const validation = requirements[primaryTarget]

  const canProceed = validation?.can_proceed ?? true
  const hasHardBlocks = (validation?.hard_blocks?.length ?? 0) > 0
  const hasSoftBlocks = (validation?.soft_blocks?.length ?? 0) > 0
  const hasPendingOverride = validation?.has_pending_override ?? false

  const primaryTargetLabel =
    SERVICE_ORDER_STATUS_CONFIG[primaryTarget]?.label ?? primaryTarget

  async function handleTransition(target: ServiceOrderStatus): Promise<void> {
    try {
      await transitionMutation.mutateAsync({ new_status: target })
      const label = SERVICE_ORDER_STATUS_CONFIG[target]?.label ?? target
      toast.success(`Status atualizado para "${label}"`)
      onTransitionSuccess?.()
    } catch (err: unknown) {
      // Use the pre-loaded transition_requirements from the order to determine
      // block type — ApiError doesn't expose the raw backend body for top-level
      // non-field keys like "transition_blocks".
      if (err instanceof ApiError && err.status === 422) {
        const targetValidation = requirements[target]
        const targetHardBlocks = (targetValidation?.hard_blocks?.length ?? 0) > 0
        const targetSoftBlocks = (targetValidation?.soft_blocks?.length ?? 0) > 0
        if (targetHardBlocks) {
          toast.error("Transição bloqueada — preencha os campos obrigatórios")
        } else if (targetSoftBlocks) {
          setSelectedTarget(target)
          setOverrideModalOpen(true)
        } else {
          toast.error(err.message ?? "Erro ao avançar status")
        }
      } else {
        toast.error("Erro ao avançar status. Tente novamente.")
      }
    }
  }

  async function handleForceWithCredentials(): Promise<void> {
    if (!selectedTarget) return
    try {
      await transitionMutation.mutateAsync({
        new_status: selectedTarget,
        force: true,
        manager_email: managerEmail,
        manager_password: managerPassword,
        justification: overrideReason,
      })
      const label = SERVICE_ORDER_STATUS_CONFIG[selectedTarget]?.label ?? selectedTarget
      toast.success(`Status atualizado para "${label}" (liberado pelo gerente)`)
      setManagerModalOpen(false)
      setOverrideModalOpen(false)
      setManagerEmail("")
      setManagerPassword("")
      setOverrideReason("")
      onTransitionSuccess?.()
    } catch {
      toast.error("Credenciais inválidas ou permissão insuficiente")
    }
  }

  async function handleRequestRemoteOverride(): Promise<void> {
    if (!selectedTarget || !overrideReason.trim()) return
    try {
      await overrideMutation.mutateAsync({
        target_status: selectedTarget,
        reason: overrideReason,
      })
      setOverrideModalOpen(false)
      setOverrideReason("")
    } catch {
      // handled by hook
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header com seletor de destino */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Para avançar para{" "}
          <span className="text-primary">{primaryTargetLabel}</span>:
        </h3>
        {allowedTransitions.length > 1 && (
          <select
            className="text-xs border rounded px-2 py-1 bg-background"
            value={primaryTarget}
            onChange={(e) =>
              setSelectedTarget(e.target.value as ServiceOrderStatus)
            }
          >
            {allowedTransitions.map((s) => (
              <option key={s} value={s}>
                {SERVICE_ORDER_STATUS_CONFIG[s]?.label ?? s}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Lista de requisitos */}
      {validation && (
        <ul className="space-y-1.5" role="list" aria-label="Requisitos de transição">
          {validation.hard_blocks?.map((b) => (
            <li key={b.code} className="flex items-start gap-2 text-sm text-error-500">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{b.message}</span>
            </li>
          ))}
          {validation.soft_blocks?.map((b) => (
            <li key={b.code} className="flex items-start gap-2 text-sm text-warning-500">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{b.message}</span>
            </li>
          ))}
          {validation.warnings?.map((w) => (
            <li key={w.code} className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {w.message}{" "}
                <span className="text-xs opacity-60">(opcional)</span>
              </span>
            </li>
          ))}
          {canProceed && !hasHardBlocks && !hasSoftBlocks && (
            <li className="flex items-center gap-2 text-sm text-success-500">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Todos os requisitos atendidos</span>
            </li>
          )}
        </ul>
      )}

      {/* Botoes de acao */}
      <div className="flex gap-2 pt-1">
        {canProceed ? (
          <Button
            size="sm"
            onClick={() => void handleTransition(primaryTarget)}
            disabled={transitionMutation.isPending}
          >
            {transitionMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
            )}
            Avançar Status
          </Button>
        ) : hasHardBlocks ? (
          <p className="text-xs text-muted-foreground italic">
            Preencha os campos obrigatórios acima para avançar
          </p>
        ) : hasSoftBlocks ? (
          <>
            <Button size="sm" disabled variant="outline">
              Avançar Status
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={hasPendingOverride}
              title={hasPendingOverride ? "Já existe uma solicitação pendente para este status" : undefined}
              onClick={() => setOverrideModalOpen(true)}
            >
              Solicitar Liberação
            </Button>
          </>
        ) : null}
      </div>

      {/* Indicador de override pendente */}
      {hasPendingOverride && (
        <div
          role="status"
          className="rounded-md bg-info-500/10 border border-info-500/20 px-3 py-2 text-xs text-info-600 flex items-center gap-2"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
          Solicitação de liberação pendente — aguardando aprovação do gerente
        </div>
      )}

      {/* Modal de solicitacao de override */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Liberação — OS #{order.number}</DialogTitle>
            <DialogDescription>
              Transição:{" "}
              {SERVICE_ORDER_STATUS_CONFIG[order.status as ServiceOrderStatus]?.label ??
                order.status}{" "}
              → {primaryTargetLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-2">Bloqueios pendentes:</p>
              <ul className="space-y-1">
                {validation?.soft_blocks?.map((b) => (
                  <li
                    key={b.code}
                    className="flex items-start gap-2 text-sm text-warning-500"
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
                <span className="text-error-500" aria-hidden="true">*</span>
              </label>
              <textarea
                id="override-reason"
                aria-required="true"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={3}
                placeholder="Explique por que a transição deve ser liberada..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Como liberar:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!overrideReason.trim()) {
                      toast.error("Preencha o motivo da solicitação")
                      return
                    }
                    setManagerModalOpen(true)
                  }}
                >
                  Gerente presente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!overrideReason.trim() || overrideMutation.isPending}
                  onClick={() => void handleRequestRemoteOverride()}
                >
                  {overrideMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
                  ) : null}
                  Aprovacao remota
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de credenciais do gerente */}
      <Dialog open={managerModalOpen} onOpenChange={setManagerModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Credenciais do Gerente</DialogTitle>
            <DialogDescription>
              O gerente deve digitar suas credenciais para autorizar a transição.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="manager-email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="manager-email"
                type="email"
                autoComplete="username"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="gerente@dscar.com"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="manager-password" className="text-sm font-medium">
                Senha
              </label>
              <input
                id="manager-password"
                type="password"
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManagerModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={
                !managerEmail || !managerPassword || transitionMutation.isPending
              }
              onClick={() => void handleForceWithCredentials()}
            >
              {transitionMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
              )}
              Autorizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
