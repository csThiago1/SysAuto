"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Send, CheckCircle, XCircle, RotateCcw, Copy, Download, ExternalLink } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { usePermission } from "@/hooks/usePermission"
import {
  useApproveBudget,
  useCloneBudget,
  useRejectBudget,
  useRequestRevision,
  useSendBudget,
} from "@/hooks/useBudgets"
import type { Budget, BudgetVersionStatus } from "@paddock/types"

const STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft:      "Rascunho",
  sent:       "Enviado",
  approved:   "Aprovado",
  rejected:   "Rejeitado",
  expired:    "Expirado",
  revision:   "Em Revisão",
  superseded: "Superado",
}

const STATUS_COLORS: Record<BudgetVersionStatus, string> = {
  draft:      "text-muted-foreground bg-muted border-border",
  sent:       "text-info-400 bg-info-400/10 border-info-400/20",
  approved:   "text-success-400 bg-success-400/10 border-success-400/20",
  rejected:   "text-error-400 bg-error-400/10 border-error-400/20",
  expired:    "text-warning-400 bg-warning-400/10 border-warning-400/20",
  revision:   "text-warning-400 bg-warning-400/10 border-warning-400/20",
  superseded: "text-muted-foreground/50 bg-muted/50 border-white/5",
}

interface Props { budget: Budget }

export function BudgetHeader({ budget }: Props) {
  const router    = useRouter()
  const canManage = usePermission("MANAGER")
  const version   = budget.active_version
  const status    = version?.status ?? "draft"

  const [confirmSend,    setConfirmSend]    = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [confirmReject,  setConfirmReject]  = useState(false)

  const { mutateAsync: send,     isPending: sending }   = useSendBudget(budget.id)
  const { mutateAsync: approve,  isPending: approving } = useApproveBudget(budget.id)
  const { mutateAsync: reject,   isPending: rejecting } = useRejectBudget(budget.id)
  const { mutateAsync: revision, isPending: revising }  = useRequestRevision(budget.id)
  const { mutateAsync: clone,    isPending: cloning }   = useCloneBudget()

  async function handleSend() {
    if (!version) return
    try {
      await send(version.id)
      toast.success("Orçamento enviado ao cliente.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar.")
    }
    setConfirmSend(false)
  }

  async function handleApprove() {
    if (!version) return
    try {
      const res = await approve({ versionId: version.id, payload: { approved_by: "gerente" } })
      toast.success(`OS #${res.service_order.number} criada com sucesso!`)
      router.push(`/os/${res.service_order.number}` as Route)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar.")
    }
    setConfirmApprove(false)
  }

  async function handleReject() {
    if (!version) return
    try {
      await reject(version.id)
      toast.success("Orçamento rejeitado.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao rejeitar.")
    }
    setConfirmReject(false)
  }

  async function handleRevision() {
    if (!version) return
    try {
      await revision(version.id)
      toast.success("Nova versão de revisão criada.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao solicitar revisão.")
    }
  }

  async function handleClone() {
    try {
      const nb = await clone(budget.id)
      toast.success(`Orçamento ${nb.number} criado.`)
      router.push(`/orcamentos-particulares/${nb.id}` as Route)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao clonar.")
    }
  }

  const pdfUrl = version?.pdf_s3_key
    ? `/api/proxy/budgets/${budget.id}/versions/${version.id}/pdf/`
    : null

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        {/* Esquerda: voltar + info */}
        <div className="flex items-center gap-3">
          <Link href={"/orcamentos-particulares" as Route}>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-foreground">{budget.number}</span>
              {version && (
                <span className="text-muted-foreground text-sm">v{version.version_number}</span>
              )}
              {version && (
                <Badge className={`text-xs border ${STATUS_COLORS[status]}`}>
                  {STATUS_LABELS[status]}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              {budget.vehicle_make_logo && (
                <img src={budget.vehicle_make_logo} alt="" className="h-4 w-4 object-contain inline-block" />
              )}
              {budget.customer_name} · {budget.vehicle_plate} · {budget.vehicle_description}
            </p>
          </div>
        </div>

        {/* Direita: ações */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </a>
          )}

          {/* OS vinculada */}
          {status === "approved" && budget.service_order && (
            <Link href={`/os/${budget.service_order}` as Route}>
              <Button variant="outline" size="sm" className="gap-1.5 border-success-400/30 text-success-400 hover:bg-success-400/10">
                <ExternalLink className="h-4 w-4" />
                Ver OS
              </Button>
            </Link>
          )}

          {/* Clonar (rejected/expired) */}
          {(status === "rejected" || status === "expired") && (
            <Button
              variant="ghost"
              size="sm"
              disabled={cloning}
              onClick={handleClone}
              className="gap-1.5 text-foreground/60 hover:text-foreground"
            >
              <Copy className="h-4 w-4" />
              Clonar
            </Button>
          )}

          {/* Solicitar revisão (sent) */}
          {status === "sent" && canManage && (
            <Button
              variant="ghost"
              size="sm"
              disabled={revising}
              onClick={handleRevision}
              className="gap-1.5 text-warning-400 hover:text-warning-300"
            >
              <RotateCcw className="h-4 w-4" />
              Revisão
            </Button>
          )}

          {/* Rejeitar (sent) */}
          {status === "sent" && canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmReject(true)}
              className="gap-1.5 text-error-400 hover:text-error-300"
            >
              <XCircle className="h-4 w-4" />
              Rejeitar
            </Button>
          )}

          {/* Aprovar (sent) */}
          {status === "sent" && canManage && (
            <Button
              size="sm"
              disabled={approving}
              onClick={() => setConfirmApprove(true)}
              className="gap-1.5 bg-success-600 hover:bg-success-700 text-foreground"
            >
              <CheckCircle className="h-4 w-4" />
              Aprovar → OS
            </Button>
          )}

          {/* Enviar (draft) */}
          {status === "draft" && version && version.items.length > 0 && (
            <Button
              size="sm"
              disabled={sending}
              onClick={() => setConfirmSend(true)}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              Enviar ao Cliente
            </Button>
          )}
        </div>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title="Enviar orçamento?"
        description="O orçamento será enviado ao cliente e ficará imutável. Confirma?"
        onConfirm={handleSend}
        confirmLabel="Enviar"
      />
      <ConfirmDialog
        open={confirmApprove}
        onOpenChange={setConfirmApprove}
        title="Aprovar e criar OS?"
        description="Uma Ordem de Serviço particular será criada automaticamente. Essa ação não pode ser desfeita."
        onConfirm={handleApprove}
        confirmLabel="Aprovar"
      />
      <ConfirmDialog
        open={confirmReject}
        onOpenChange={setConfirmReject}
        title="Rejeitar orçamento?"
        description="O orçamento será marcado como rejeitado. Você poderá clonar para criar uma nova versão."
        onConfirm={handleReject}
        confirmLabel="Rejeitar"
        variant="destructive"
      />
    </>
  )
}
