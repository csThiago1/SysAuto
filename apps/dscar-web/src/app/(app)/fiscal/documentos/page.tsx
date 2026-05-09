"use client"

/**
 * Documentos Fiscais Emitidos — CONSULTANT+
 * Ciclo 06C
 *
 * Lista NFS-e / NF-e / NFC-e emitidas pela empresa,
 * com filtros por tipo, status e busca por ref.
 */

import { useState } from "react"
import { FileText, RefreshCw, XCircle, CheckCircle2, Clock, AlertCircle, Mail, X, ArrowRightLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useFiscalDocuments, useCancelFiscalDoc, useSendFiscalEmail, useSubstituirNfse, useCCe } from "@/hooks/useFiscal"
import { usePermission } from "@/hooks/usePermission"
import type { FiscalDocumentList } from "@paddock/types"
import { cn } from "@/lib/utils"

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  pending: {
    label: "Aguardando",
    icon: Clock,
    color: "text-warning-400",
    bg: "bg-warning-400/10",
  },
  authorized: {
    label: "Autorizada",
    icon: CheckCircle2,
    color: "text-success-400",
    bg: "bg-success-400/10",
  },
  rejected: {
    label: "Rejeitada",
    icon: AlertCircle,
    color: "text-error-400",
    bg: "bg-red-400/10",
  },
  cancelled: {
    label: "Cancelada",
    icon: XCircle,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
  },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  nfse: "NFS-e",
  nfe: "NF-e",
  nfce: "NFC-e",
}

const JUSTIFICATIVA_OPTIONS = [
  { value: "01", label: "01 — Erro cadastral" },
  { value: "02", label: "02 — Erro descrição" },
  { value: "03", label: "03 — Erro tributação" },
  { value: "04", label: "04 — Erro valor" },
  { value: "05", label: "05 — Outros" },
  { value: "99", label: "99 — Não especificado" },
]

// ─── Substituir Dialog ─────────────────────────────────────────────────────────

interface SubstituirDialogProps {
  doc: FiscalDocumentList | null
  open: boolean
  onClose: () => void
}

function SubstituirDialog({ doc, open, onClose }: SubstituirDialogProps) {
  const [serviceOrderId, setServiceOrderId] = useState("")
  const [codigoJustificativa, setCodigoJustificativa] = useState("01")

  const substituirMutation = useSubstituirNfse()

  async function handleSubmit() {
    if (!doc?.key) {
      toast.error("Documento sem chave de acesso.")
      return
    }
    try {
      const result = await substituirMutation.mutateAsync({
        chave_nfse_substituida: doc.key,
        service_order_id: serviceOrderId.trim() || undefined,
        codigo_justificativa: codigoJustificativa,
      })
      toast.success(`NFS-e substituída. Nova ref: ${result.nova_ref}`)
      setServiceOrderId("")
      setCodigoJustificativa("01")
      onClose()
    } catch {
      toast.error("Erro ao substituir NFS-e. Verifique os dados e tente novamente.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            Substituir NFS-e
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {doc && (
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs space-y-0.5">
              <p className="text-muted-foreground">NFS-e a ser substituída:</p>
              <p className="font-mono text-foreground/80 truncate">{doc.key ?? doc.ref ?? "—"}</p>
              {doc.numero && (
                <p className="text-muted-foreground">Número: {doc.numero}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              ID da Ordem de Serviço <span className="text-muted-foreground">(UUID)</span>
            </label>
            <input
              type="text"
              value={serviceOrderId}
              onChange={(e) => setServiceOrderId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Código de justificativa
            </label>
            <select
              value={codigoJustificativa}
              onChange={(e) => setCodigoJustificativa(e.target.value)}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {JUSTIFICATIVA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={substituirMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={substituirMutation.isPending}
          >
            {substituirMutation.isPending ? "Substituindo..." : "Substituir NFS-e"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Send Email Dialog ────────────────────────────────────────────────────────

function SendEmailDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: FiscalDocumentList | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [emailInput, setEmailInput] = useState("")
  const [emails, setEmails] = useState<string[]>([])
  const sendEmail = useSendFiscalEmail()

  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  }

  function handleAdd() {
    const trimmed = emailInput.trim()
    if (!trimmed) return
    if (!isValidEmail(trimmed)) {
      toast.error("Email inválido.")
      return
    }
    if (emails.includes(trimmed)) {
      toast.error("Email já adicionado.")
      return
    }
    if (emails.length >= 10) {
      toast.error("Máximo de 10 emails por envio.")
      return
    }
    setEmails((prev) => [...prev, trimmed])
    setEmailInput("")
  }

  function handleRemove(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  async function handleSend() {
    if (!doc) return
    if (emails.length === 0) {
      toast.error("Adicione ao menos um email.")
      return
    }
    try {
      await sendEmail.mutateAsync({ documentId: doc.id, emails })
      toast.success("Documento enviado por email com sucesso.")
      onOpenChange(false)
      setEmails([])
      setEmailInput("")
    } catch {
      toast.error("Erro ao enviar email. Tente novamente.")
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setEmails([])
      setEmailInput("")
    }
    onOpenChange(open)
  }

  const docLabel = doc
    ? `${DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type.toUpperCase()} ${doc.numero ? `#${doc.numero}` : doc.ref ?? ""}`
    : ""

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Documento por Email</DialogTitle>
          {doc && (
            <p className="text-xs text-muted-foreground mt-1">{docLabel}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Input */}
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="email@exemplo.com"
              disabled={emails.length >= 10}
              className={cn(
                "flex-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={emails.length >= 10 || !emailInput.trim()}
            >
              Adicionar
            </Button>
          </div>

          {/* Chips */}
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border px-3 py-1 text-xs text-foreground"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => handleRemove(email)}
                    className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Remover ${email}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {emails.length}/10 email(s) adicionado(s). Pressione Enter ou clique em Adicionar.
          </p>
        </div>

        <DialogFooter className="mt-6 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleClose(false)}
            disabled={sendEmail.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={emails.length === 0 || sendEmail.isPending}
          >
            {sendEmail.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── CCe Dialog ──────────────────────────────────────────────────────────────

function CceDialog({
  doc,
  open,
  onOpenChange,
}: {
  doc: FiscalDocumentList | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [correcao, setCorrecao] = useState("")
  const cceMutation = useCCe()

  const charCount = correcao.length
  const isValid = charCount >= 15 && charCount <= 1000

  async function handleSubmit(): Promise<void> {
    if (!doc || !isValid) return
    try {
      await cceMutation.mutateAsync({ documentId: doc.id, correcao })
      toast.success(`Carta de Correção #${(doc.cce_count || 0) + 1} emitida com sucesso.`)
      setCorrecao("")
      onOpenChange(false)
    } catch {
      toast.error("Erro ao emitir Carta de Correção. Tente novamente.")
    }
  }

  function handleClose(value: boolean) {
    if (!value) setCorrecao("")
    onOpenChange(value)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Carta de Correção Eletrônica</DialogTitle>
          <DialogDescription>
            NF-e {doc?.numero ? `#${doc.numero}` : doc?.ref ?? ""}
            {doc?.cce_count ? ` — ${doc.cce_count}/20 CCe emitida(s)` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Aviso */}
          <div className="rounded-lg bg-warning-400/10 border border-warning-400/20 p-3">
            <p className="text-xs text-warning-400">
              A CCe só permite corrigir dados secundários. Não é possível alterar
              valores, quantidades, dados do emitente/destinatário ou impostos.
            </p>
          </div>

          {/* Textarea */}
          <div>
            <label
              htmlFor="cce-correcao"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Texto da correção
            </label>
            <textarea
              id="cce-correcao"
              value={correcao}
              onChange={(e) => setCorrecao(e.target.value)}
              placeholder="Descreva a correção a ser aplicada (mín. 15 caracteres)..."
              rows={5}
              maxLength={1000}
              className={cn(
                "w-full rounded-md border bg-muted/50 px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground resize-none",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                charCount > 0 && charCount < 15
                  ? "border-error-400"
                  : "border-border"
              )}
            />
            <p
              className={cn(
                "text-xs mt-1 text-right",
                charCount > 0 && charCount < 15
                  ? "text-error-400"
                  : "text-muted-foreground"
              )}
            >
              {charCount}/1000 caracteres
              {charCount > 0 && charCount < 15 && " (mínimo 15)"}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleClose(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isValid || cceMutation.isPending}
            onClick={handleSubmit}
          >
            {cceMutation.isPending ? "Emitindo..." : "Emitir CCe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function FiscalDocRow({
  doc,
  canCancel,
  canSubstituir,
  onCancel,
  onSendEmail,
  onSubstituir,
  onCCe,
}: {
  doc: FiscalDocumentList
  canCancel: boolean
  canSubstituir: boolean
  onCancel: (id: string) => void
  onSendEmail: (doc: FiscalDocumentList) => void
  onSubstituir: (doc: FiscalDocumentList) => void
  onCCe: (doc: FiscalDocumentList) => void
}) {
  const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon

  const valorFmt = doc.amount
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
        Number(doc.amount)
      )
    : "—"

  const dateFmt = new Date(doc.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      {/* Tipo */}
      <td className="py-3 px-4 text-xs font-mono text-foreground/70">
        {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type.toUpperCase()}
      </td>

      {/* Ref */}
      <td className="py-3 px-4 text-xs font-mono text-muted-foreground max-w-[180px] truncate">
        {doc.ref ?? "—"}
      </td>

      {/* Número */}
      <td className="py-3 px-4 text-xs text-foreground/70">
        {doc.numero ?? "—"}
      </td>

      {/* Valor */}
      <td className="py-3 px-4 text-xs text-foreground/80 text-right tabular-nums">
        {valorFmt}
      </td>

      {/* Status */}
      <td className="py-3 px-4">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
            cfg.bg,
            cfg.color
          )}
        >
          <Icon className="h-3 w-3" />
          {cfg.label}
        </span>
      </td>

      {/* Ambiente */}
      <td className="py-3 px-4 text-xs text-muted-foreground">
        {doc.environment === "homologacao" ? "Homolog." : "Produção"}
      </td>

      {/* Data */}
      <td className="py-3 px-4 text-xs text-muted-foreground">{dateFmt}</td>

      {/* Ações */}
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {doc.pdf_url && (
            <a
              href={`/api/proxy${doc.pdf_url.replace("/api/v1/", "/")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-primary"
            >
              PDF
            </a>
          )}
          {doc.xml_url && (
            <a
              href={`/api/proxy${doc.xml_url.replace("/api/v1/", "/")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground/60"
            >
              XML
            </a>
          )}
          {doc.status === "authorized" && (
            <button
              onClick={() => onSendEmail(doc)}
              title="Enviar por email"
              className="text-muted-foreground hover:text-foreground/70 transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
            </button>
          )}
          {canSubstituir && doc.status === "authorized" && doc.document_type === "nfse" && (
            <button
              onClick={() => onSubstituir(doc)}
              className="text-xs text-info-400/70 hover:text-info-400"
            >
              Substituir
            </button>
          )}
          {canCancel && doc.status === "authorized" && doc.document_type === "nfe" && doc.cce_count < 20 && (
            <button
              onClick={() => onCCe(doc)}
              className="text-xs text-warning-400/70 hover:text-warning-400"
            >
              CCe{doc.cce_count > 0 ? ` (${doc.cce_count})` : ""}
            </button>
          )}
          {canCancel && doc.status === "authorized" && (
            <button
              onClick={() => onCancel(doc.id)}
              className="text-xs text-error-400/70 hover:text-error-400"
            >
              Cancelar
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FiscalDocumentosPage() {
  const canCancel = usePermission("MANAGER")
  const canSubstituir = usePermission("ADMIN")

  const [docType, setDocType] = useState("")
  const [docStatus, setDocStatus] = useState("")

  const { data: docs = [], isLoading, refetch } = useFiscalDocuments({
    document_type: docType || undefined,
    status: docStatus || undefined,
  })

  const cancelMutation = useCancelFiscalDoc()

  // Email dialog state
  const [emailDialogDoc, setEmailDialogDoc] = useState<FiscalDocumentList | null>(null)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)

  // Substituir dialog state
  const [substituirDoc, setSubstituirDoc] = useState<FiscalDocumentList | null>(null)

  // CCe dialog state
  const [cceDoc, setCceDoc] = useState<FiscalDocumentList | null>(null)
  const [cceOpen, setCceOpen] = useState(false)

  async function handleCancel(id: string) {
    const justificativa = window.prompt("Justificativa para cancelamento (mín. 15 caracteres):")
    if (!justificativa || justificativa.trim().length < 15) {
      toast.error("Justificativa deve ter ao menos 15 caracteres.")
      return
    }
    try {
      await cancelMutation.mutateAsync({ id, justificativa })
      toast.success("Documento cancelado.")
    } catch {
      toast.error("Erro ao cancelar documento.")
    }
  }

  function handleOpenEmailDialog(doc: FiscalDocumentList) {
    setEmailDialogDoc(doc)
    setEmailDialogOpen(true)
  }

  function handleOpenCCe(doc: FiscalDocumentList) {
    setCceDoc(doc)
    setCceOpen(true)
  }

  const totais = {
    pending: docs.filter((d) => d.status === "pending").length,
    authorized: docs.filter((d) => d.status === "authorized").length,
    rejected: docs.filter((d) => d.status === "rejected").length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Documentos Fiscais</h1>
            <p className="text-xs text-muted-foreground mt-0.5">NFS-e, NF-e e NFC-e emitidas pela empresa</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Aguardando", value: totais.pending, color: "text-warning-400" },
          { label: "Autorizadas", value: totais.authorized, color: "text-success-400" },
          { label: "Rejeitadas", value: totais.rejected, color: "text-error-400" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-muted/30 border border-white/[0.07] px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={cn("text-2xl font-bold mt-0.5", kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">Todos os tipos</option>
          <option value="nfse">NFS-e</option>
          <option value="nfe">NF-e</option>
          <option value="nfce">NFC-e</option>
        </select>
        <select
          value={docStatus}
          onChange={(e) => setDocStatus(e.target.value)}
          className="rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">Todos os status</option>
          <option value="pending">Aguardando</option>
          <option value="authorized">Autorizada</option>
          <option value="rejected">Rejeitada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="rounded-xl bg-muted/30 border border-white/[0.07] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Tipo", "Ref", "Número", "Valor", "Status", "Ambiente", "Emissão", ""].map(
                (h) => (
                  <th
                    key={h}
                    className={cn(
                      "py-2.5 px-4 text-xs font-semibold text-muted-foreground text-left",
                      h === "Valor" && "text-right"
                    )}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                  Nenhum documento fiscal encontrado.
                </td>
              </tr>
            ) : (
              docs.map((doc) => (
                <FiscalDocRow
                  key={doc.id}
                  doc={doc}
                  canCancel={canCancel}
                  canSubstituir={canSubstituir}
                  onCancel={handleCancel}
                  onSendEmail={handleOpenEmailDialog}
                  onSubstituir={(d) => setSubstituirDoc(d)}
                  onCCe={handleOpenCCe}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {docs.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">{docs.length} documento(s)</p>
      )}

      {/* Email Dialog */}
      <SendEmailDialog
        doc={emailDialogDoc}
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
      />

      {/* Substituir Dialog */}
      <SubstituirDialog
        doc={substituirDoc}
        open={Boolean(substituirDoc)}
        onClose={() => setSubstituirDoc(null)}
      />

      {/* CCe Dialog */}
      <CceDialog doc={cceDoc} open={cceOpen} onOpenChange={setCceOpen} />
    </div>
  )
}
