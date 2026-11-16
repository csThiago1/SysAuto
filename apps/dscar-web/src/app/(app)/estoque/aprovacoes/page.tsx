"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import type { MovimentacaoEstoque, TipoMovimentacao } from "@paddock/types"
import {
  useAprovacoesPendentes,
  useAprovar,
  useRejeitar,
} from "@/hooks/useInventoryMovement"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

// ─── Tipo badge config ──────────────────────────────────────────────────────

const TIPO_CONFIG: Record<
  TipoMovimentacao,
  { label: string; className: string }
> = {
  entrada_nf: {
    label: "Entrada NF",
    className: "bg-success-500/10 text-success-400",
  },
  entrada_manual: {
    label: "Entrada Manual",
    className: "bg-success-500/10 text-success-400",
  },
  entrada_devolucao: {
    label: "Devolucao",
    className: "bg-success-500/10 text-success-400",
  },
  saida_os: {
    label: "Saida OS",
    className: "bg-warning-500/10 text-warning-400",
  },
  saida_perda: {
    label: "Perda",
    className: "bg-error-500/10 text-error-400",
  },
  transferencia: {
    label: "Transferencia",
    className: "bg-info-500/10 text-info-400",
  },
  ajuste_inventario: {
    label: "Ajuste",
    className: "bg-purple-500/10 text-purple-400",
  },
}

function formatDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AprovacoesPage() {
  const { data: pendentes = [], isLoading } = useAprovacoesPendentes()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectMotivo, setRejectMotivo] = useState("")

  const count = pendentes.length

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">
            Aprovacoes Pendentes
          </h1>
          {count > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-error-500/10 text-error-400 text-xs font-mono px-1.5">
              {count}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : count === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-12 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-white/10 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Nenhuma aprovacao pendente.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="px-3 py-2">
                  DATA
                </TableHead>
                <TableHead className="px-3 py-2">
                  TIPO
                </TableHead>
                <TableHead className="px-3 py-2">
                  ITEM
                </TableHead>
                <TableHead className="px-3 py-2">
                  MOTIVO
                </TableHead>
                <TableHead className="px-3 py-2">
                  EVIDENCIA
                </TableHead>
                <TableHead className="px-3 py-2">
                  SOLICITADO POR
                </TableHead>
                <TableHead className="text-right px-3 py-2">
                  ACOES
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendentes.map((mov) => (
                <ApprovalRow
                  key={mov.id}
                  mov={mov}
                  isRejecting={rejectingId === mov.id}
                  rejectMotivo={rejectMotivo}
                  onRejectMotivoChange={setRejectMotivo}
                  onOpenReject={() => {
                    setRejectingId(mov.id)
                    setRejectMotivo("")
                  }}
                  onCancelReject={() => {
                    setRejectingId(null)
                    setRejectMotivo("")
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Approval Row ───────────────────────────────────────────────────────────

function ApprovalRow({
  mov,
  isRejecting,
  rejectMotivo,
  onRejectMotivoChange,
  onOpenReject,
  onCancelReject,
}: {
  mov: MovimentacaoEstoque
  isRejecting: boolean
  rejectMotivo: string
  onRejectMotivoChange: (v: string) => void
  onOpenReject: () => void
  onCancelReject: () => void
}) {
  const aprovarMut = useAprovar(mov.id)
  const rejeitarMut = useRejeitar(mov.id)

  const cfg = TIPO_CONFIG[mov.tipo] ?? {
    label: mov.tipo_display,
    className: "bg-muted text-foreground/60",
  }
  const barcode = mov.unidade_barcode || mov.lote_barcode || "—"

  async function handleAprovar() {
    try {
      await aprovarMut.mutateAsync()
      toast.success("Movimentacao aprovada.")
    } catch {
      toast.error("Erro ao aprovar.")
    }
  }

  async function handleRejeitar() {
    if (!rejectMotivo.trim()) {
      toast.error("Informe o motivo da rejeicao.")
      return
    }
    try {
      await rejeitarMut.mutateAsync()
      toast.success("Movimentacao rejeitada.")
      onCancelReject()
    } catch {
      toast.error("Erro ao rejeitar.")
    }
  }

  return (
    <>
      <TableRow className="border-white/5">
        <TableCell className="px-3 py-2 text-foreground/70 whitespace-nowrap text-xs">
          {formatDateShort(mov.created_at)}
        </TableCell>
        <TableCell className="px-3 py-2">
          <span
            className={`inline-block text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded ${cfg.className}`}
          >
            {cfg.label}
          </span>
        </TableCell>
        <TableCell className="px-3 py-2 font-mono text-xs text-foreground/60">
          {barcode}
        </TableCell>
        <TableCell className="px-3 py-2 text-muted-foreground text-xs max-w-[200px] truncate">
          {mov.motivo || "—"}
        </TableCell>
        <TableCell className="px-3 py-2">
          {mov.evidencia ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mov.evidencia}
              alt="Evidencia"
              className="h-8 w-8 rounded object-cover border border-border"
            />
          ) : (
            <span className="text-muted-foreground/50 text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="px-3 py-2 text-muted-foreground text-xs">
          {mov.realizado_por_nome || "—"}
        </TableCell>
        <TableCell className="px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleAprovar}
              disabled={aprovarMut.isPending}
              className="rounded-md bg-success-500/10 text-success-400 px-3 py-1 text-xs font-medium hover:bg-success-500/20 disabled:opacity-50 transition-colors"
            >
              {aprovarMut.isPending ? "..." : "Aprovar"}
            </button>
            <button
              type="button"
              onClick={onOpenReject}
              disabled={rejeitarMut.isPending}
              className="rounded-md border border-border text-muted-foreground px-3 py-1 text-xs hover:text-foreground hover:border-border disabled:opacity-50 transition-colors"
            >
              Rejeitar
            </button>
          </div>
        </TableCell>
      </TableRow>
      {isRejecting && (
        <TableRow className="bg-white/[0.02]">
          <TableCell colSpan={7}>
            <div className="flex items-end gap-3 max-w-lg">
              <div className="flex-1">
                <label className="label-mono text-muted-foreground mb-1.5 block">
                  MOTIVO DA REJEICAO
                </label>
                <Input
                  type="text"
                  value={rejectMotivo}
                  onChange={(e) => onRejectMotivoChange(e.target.value)}
                  placeholder="Descreva o motivo..."
                  className="w-full"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={handleRejeitar}
                disabled={rejeitarMut.isPending}
                className="rounded-md bg-error-500/10 text-error-400 px-3 py-2 text-xs font-medium hover:bg-error-500/20 disabled:opacity-50 transition-colors"
              >
                {rejeitarMut.isPending ? "..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={onCancelReject}
                className="rounded-md border border-border text-muted-foreground px-3 py-2 text-xs hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
