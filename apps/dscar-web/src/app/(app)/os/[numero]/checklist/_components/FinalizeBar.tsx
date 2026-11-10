"use client"

import { useState, type ReactElement } from "react"
import { AlertTriangle, FileText, Loader2, Lock, MessageCircle, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { STOPS } from "@paddock/car-3d"

import { SignatureSection } from "@/components/signature/SignatureSection"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { usePermission } from "@/hooks/usePermission"
import { cn } from "@/lib/utils"

import {
  useBudgetReport,
  useFinalizeChecklist,
  usePatchChecklist,
  useReopenChecklist,
  useSignChecklist,
  type FinalizePayload,
} from "../_hooks/useEntryChecklist"
import { missingFrom, toastChecklistError } from "../_lib/checklistErrors"
import type { ChecklistDamage, EntryChecklistState } from "../_schemas/checklist.schema"
import { RemoteLinkDialog } from "./RemoteLinkDialog"

const SEAL: Record<EntryChecklistState["signature_status"], { label: string; cls: string }> = {
  pendente: { label: "Assinatura pendente", cls: "border-warning-500/40 bg-warning-500/10 text-warning-400" },
  presencial: { label: "Assinado presencial", cls: "border-success-500/40 bg-success-500/10 text-success-400" },
  remoto: { label: "Assinado remoto", cls: "border-success-500/40 bg-success-500/10 text-success-400" },
}

/** Texto de cada pendência do finalize (`stop:frente`, `damage:3:photo`, `body_type`, `snapshot:left`). */
function missingLabel(item: string): string {
  const [kind, key] = item.split(":")
  if (kind === "stop") {
    const stop = STOPS.find((s) => s.key === key)
    return `${stop?.label ?? key}: marque um dano ou "sem dano"`
  }
  if (kind === "damage") return `Dano ${key} sem foto`
  if (kind === "body_type") return "Escolha a carroceria"
  return "Uma vista do carro não foi gerada — finalize de novo"
}

type Props = {
  osId: string
  state: EntryChecklistState
  damages: ChecklistDamage[]
  customerName: string
  /** OS de seguradora com orçamento cruzado: libera o relatório de cruzamento. */
  hasBudget: boolean
  modelCredit: string | null
  takeSnapshots: () => Promise<FinalizePayload["snapshots"]>
  /** Leva à parada (câmera) ou abre o dano da pendência clicada. */
  onMissing: (item: string) => void
}

export function FinalizeBar({
  osId,
  state,
  damages,
  customerName,
  hasBudget,
  modelCredit,
  takeSnapshots,
  onMissing,
}: Props): ReactElement {
  const locked = state.finalized_at !== null
  const isManager = usePermission("MANAGER")
  const [missing, setMissing] = useState<string[]>([])
  const [snapping, setSnapping] = useState(false)
  const [remoteOpen, setRemoteOpen] = useState(false)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reason, setReason] = useState("")

  const finalize = useFinalizeChecklist(osId)
  const patch = usePatchChecklist(osId)
  const reopen = useReopenChecklist(osId)
  const sign = useSignChecklist(osId)
  const report = useBudgetReport(osId)

  async function handleFinalize(): Promise<void> {
    setSnapping(true)
    try {
      const snapshots = await takeSnapshots()
      await finalize.mutateAsync(modelCredit ? { snapshots, model_credit: modelCredit } : { snapshots })
      setMissing([])
      toast.success("Checklist finalizado. PDF gerado.")
    } catch (err) {
      const items = missingFrom(err)
      if (items) setMissing(items)
      else toastChecklistError(err, "Não deu para finalizar. Tente de novo.")
    } finally {
      setSnapping(false)
    }
  }

  async function completeStop(item: string, stopKey: string): Promise<void> {
    const stop = STOPS.find((s) => s.key === stopKey)
    const hasDamage = damages.some((d) => stop?.panels.includes(d.panel_key))
    try {
      await patch.mutateAsync({ stops_done: { [stopKey]: hasDamage ? "done" : "sem_dano" } })
      setMissing((m) => m.filter((x) => x !== item))
    } catch (err) {
      toastChecklistError(err, "Não deu para concluir a parada.")
    }
  }

  async function handleReopen(): Promise<void> {
    try {
      await reopen.mutateAsync(reason.trim())
      setReopenOpen(false)
      setReason("")
      toast.success("Checklist reaberto.")
    } catch {
      toast.error("Não deu para reabrir. Tente de novo.")
    }
  }

  function openReport(): void {
    // abre a aba no clique (Safari do iPad bloqueia window.open depois de um await)
    const win = window.open("about:blank", "_blank")
    report.mutate(undefined, {
      onSuccess: ({ pdf_url }) => {
        if (win && pdf_url) win.location.href = pdf_url
        else win?.close()
      },
      onError: () => {
        win?.close()
        toast.error("Não deu para gerar o relatório de cruzamento.")
      },
    })
  }

  const seal = SEAL[state.signature_status]
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {locked ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              Finalizado · v{state.version}
            </span>
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", seal.cls)}>{seal.label}</span>
          </>
        ) : (
          <Button onClick={() => void handleFinalize()} disabled={snapping || finalize.isPending}>
            {(snapping || finalize.isPending) && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Finalizar
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {state.pdf_url && (
            <Button asChild variant="outline" size="sm">
              <a href={state.pdf_url} target="_blank" rel="noopener noreferrer">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                PDF do checklist
              </a>
            </Button>
          )}
          {state.customer_type === "insurer" && hasBudget && (
            <Button variant="outline" size="sm" onClick={openReport} disabled={report.isPending}>
              Relatório de cruzamento
            </Button>
          )}
          {locked && isManager && (
            <Button variant="ghost" size="sm" onClick={() => setReopenOpen(true)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reabrir
            </Button>
          )}
        </div>
      </div>

      {!locked && missing.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-warning-500/30 bg-warning-500/5 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Falta para finalizar
          </p>
          <ul className="space-y-1">
            {missing.map((item) => {
              const [kind, key] = item.split(":")
              return (
                <li key={item} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMissing(item)}
                    className="min-w-0 flex-1 truncate text-left text-sm underline-offset-2 hover:underline"
                  >
                    {missingLabel(item)}
                  </button>
                  {kind === "stop" && key && (
                    <Button size="sm" variant="outline" disabled={patch.isPending} onClick={() => void completeStop(item, key)}>
                      Concluir parada
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {locked && state.signature_status === "pendente" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <SignatureSection
            osId={osId}
            customerName={customerName}
            documentType="VISTORIA_ENTRADA"
            label="Cliente assina aqui"
            sign={(png) => sign.mutateAsync({ signer_name: customerName, signature_png_base64: png })}
          />
          <Button variant="outline" className="h-auto min-h-[44px]" onClick={() => setRemoteOpen(true)}>
            <MessageCircle className="mr-1.5 h-4 w-4" />
            Enviar link pelo WhatsApp
          </Button>
        </div>
      )}

      {remoteOpen && <RemoteLinkDialog osId={osId} onClose={() => setRemoteOpen(false)} />}

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir checklist</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gera uma nova versão do PDF e volta a assinatura para pendente. A versão atual fica guardada.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo da reabertura"
            aria-label="Motivo da reabertura"
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReopenOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleReopen()} disabled={!reason.trim() || reopen.isPending}>
              Reabrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
