"use client"

/**
 * Documentos Fiscais Emitidos — CONSULTANT+
 * Ciclo 06C
 *
 * Lista NFS-e / NF-e / NFC-e emitidas pela empresa,
 * com filtros por tipo, status e busca por ref.
 */

import { useState } from "react"
import { FileText, RefreshCw, XCircle, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useFiscalDocuments, useCancelFiscalDoc } from "@/hooks/useFiscal"
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
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  cancelled: {
    label: "Cancelada",
    icon: XCircle,
    color: "text-white/30",
    bg: "bg-white/5",
  },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  nfse: "NFS-e",
  nfe: "NF-e",
  nfce: "NFC-e",
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function FiscalDocRow({
  doc,
  canCancel,
  onCancel,
}: {
  doc: FiscalDocumentList
  canCancel: boolean
  onCancel: (id: string) => void
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
    <tr className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors">
      {/* Tipo */}
      <td className="py-3 px-4 text-xs font-mono text-white/70">
        {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type.toUpperCase()}
      </td>

      {/* Ref */}
      <td className="py-3 px-4 text-xs font-mono text-white/50 max-w-[180px] truncate">
        {doc.ref ?? "—"}
      </td>

      {/* Número */}
      <td className="py-3 px-4 text-xs text-white/70">
        {doc.numero ?? "—"}
      </td>

      {/* Valor */}
      <td className="py-3 px-4 text-xs text-white/80 text-right tabular-nums">
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
      <td className="py-3 px-4 text-xs text-white/40">
        {doc.environment === "homologacao" ? "Homolog." : "Produção"}
      </td>

      {/* Data */}
      <td className="py-3 px-4 text-xs text-white/40">{dateFmt}</td>

      {/* Ações */}
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {doc.pdf_url && (
            <a
              href={`/api/proxy${doc.pdf_url.replace("/api/v1/", "/")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-600 hover:text-primary-500"
            >
              PDF
            </a>
          )}
          {doc.xml_url && (
            <a
              href={`/api/proxy${doc.xml_url.replace("/api/v1/", "/")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/60"
            >
              XML
            </a>
          )}
          {canCancel && doc.status === "authorized" && (
            <button
              onClick={() => onCancel(doc.id)}
              className="text-xs text-red-400/70 hover:text-red-400"
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

  const [docType, setDocType] = useState("")
  const [docStatus, setDocStatus] = useState("")

  const { data: docs = [], isLoading, refetch } = useFiscalDocuments({
    document_type: docType || undefined,
    status: docStatus || undefined,
  })

  const cancelMutation = useCancelFiscalDoc()

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
          <FileText className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-xl font-bold text-white">Documentos Fiscais</h1>
            <p className="text-xs text-white/50 mt-0.5">NFS-e, NF-e e NFC-e emitidas pela empresa</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="text-white/50 hover:text-white"
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
          { label: "Rejeitadas", value: totais.rejected, color: "text-red-400" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-4 py-3"
          >
            <p className="text-xs text-white/40">{kpi.label}</p>
            <p className={cn("text-2xl font-bold mt-0.5", kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-md border border-white/15 bg-white/[0.05] px-3 py-1.5 text-sm text-white"
        >
          <option value="">Todos os tipos</option>
          <option value="nfse">NFS-e</option>
          <option value="nfe">NF-e</option>
          <option value="nfce">NFC-e</option>
        </select>
        <select
          value={docStatus}
          onChange={(e) => setDocStatus(e.target.value)}
          className="rounded-md border border-white/15 bg-white/[0.05] px-3 py-1.5 text-sm text-white"
        >
          <option value="">Todos os status</option>
          <option value="pending">Aguardando</option>
          <option value="authorized">Autorizada</option>
          <option value="rejected">Rejeitada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Tipo", "Ref", "Número", "Valor", "Status", "Ambiente", "Emissão", ""].map(
                (h) => (
                  <th
                    key={h}
                    className={cn(
                      "py-2.5 px-4 text-xs font-semibold text-white/30 text-left",
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
                <td colSpan={8} className="py-12 text-center text-xs text-white/30">
                  Carregando...
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-white/30">
                  Nenhum documento fiscal encontrado.
                </td>
              </tr>
            ) : (
              docs.map((doc) => (
                <FiscalDocRow
                  key={doc.id}
                  doc={doc}
                  canCancel={canCancel}
                  onCancel={handleCancel}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {docs.length > 0 && (
        <p className="text-xs text-white/30 text-right">{docs.length} documento(s)</p>
      )}
    </div>
  )
}
