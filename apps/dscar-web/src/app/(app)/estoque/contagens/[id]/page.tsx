"use client"

import { use, useState } from "react"
import Link from "next/link"
import type { Route } from "next"
import { ClipboardList, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import type { StatusContagem, TipoContagem, ItemContagem } from "@paddock/types"
import {
  useContagem,
  useRegistrarItem,
  useFinalizarContagem,
  useCancelarContagem,
} from "@/hooks/useInventoryCounting"
import { usePermission } from "@/hooks/usePermission"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

// ─── Badge maps ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<StatusContagem, { label: string; className: string }> = {
  aberta: {
    label: "ABERTA",
    className: "bg-info-500/10 text-info-400 border border-info-500/20",
  },
  em_andamento: {
    label: "EM ANDAMENTO",
    className: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
  },
  finalizada: {
    label: "FINALIZADA",
    className: "bg-success-500/10 text-success-400 border border-success-500/20",
  },
  cancelada: {
    label: "CANCELADA",
    className: "bg-muted/50 text-muted-foreground border border-border",
  },
}

const TIPO_BADGE: Record<TipoContagem, { label: string; className: string }> = {
  ciclica: {
    label: "CÍCLICA",
    className: "bg-info-500/10 text-info-400 border border-info-500/20",
  },
  total: {
    label: "TOTAL",
    className: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function divergenceColor(value: string | null): string {
  if (!value) return "text-muted-foreground"
  const n = parseFloat(value)
  if (n > 0) return "text-success-400"
  if (n < 0) return "text-error-400"
  return "text-muted-foreground"
}

function divergenceLabel(value: string | null): string {
  if (!value) return "—"
  const n = parseFloat(value)
  if (n > 0) return `+${value}`
  return value
}

// ─── Item row ───────────────────────────────────────────────────────────────

function ItemRow({
  item,
  contagemId,
  editable,
}: {
  item: ItemContagem
  contagemId: string
  editable: boolean
}) {
  const [qtd, setQtd] = useState(item.quantidade_contada ?? "")
  const [obs, setObs] = useState(item.observacao ?? "")
  const registrar = useRegistrarItem(contagemId, item.id)

  const dirty =
    qtd !== (item.quantidade_contada ?? "") || obs !== (item.observacao ?? "")

  async function handleSave() {
    if (!qtd.trim()) {
      toast.error("Informe a quantidade contada.")
      return
    }
    try {
      await registrar.mutateAsync({
        quantidade_contada: qtd.trim(),
        observacao: obs.trim() || undefined,
      })
      toast.success("Item registrado.")
    } catch {
      toast.error("Erro ao registrar item.")
    }
  }

  return (
    <tr className="border-b border-white/5 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-foreground/60">
        {item.nivel_endereco}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-foreground/80">
        {item.unidade_barcode || item.lote_barcode || "—"}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-foreground/80 text-right">
        {item.quantidade_sistema}
      </td>
      <td className="px-4 py-3">
        {editable ? (
          <input
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            onBlur={() => {
              if (dirty && qtd.trim()) handleSave()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && dirty) handleSave()
            }}
            type="number"
            min="0"
            step="any"
            className="w-24 bg-muted/50 border border-border text-foreground rounded-md px-2 py-1 text-xs font-mono text-right placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="0"
          />
        ) : (
          <span className="font-mono text-xs text-foreground/80 text-right block">
            {item.quantidade_contada ?? "—"}
          </span>
        )}
      </td>
      <td className={`px-4 py-3 font-mono text-xs text-right ${divergenceColor(item.divergencia)}`}>
        {divergenceLabel(item.divergencia)}
      </td>
      <td className="px-4 py-3">
        {editable ? (
          <input
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={() => {
              if (dirty) handleSave()
            }}
            className="w-full bg-muted/50 border border-border text-foreground rounded-md px-2 py-1 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Observacao..."
          />
        ) : (
          <span className="text-xs text-foreground/60">
            {item.observacao || "—"}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-foreground/60">
        {item.contado_por_nome || "—"}
      </td>
      <td className="px-4 py-3">
        {editable && dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={registrar.isPending}
            className="rounded-md bg-primary-600 px-2.5 py-1 text-[10px] font-medium text-foreground hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {registrar.isPending ? "..." : "Salvar"}
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ContagemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: contagem, isLoading } = useContagem(id)
  const finalizarMut = useFinalizarContagem(id)
  const cancelarMut = useCancelarContagem(id)
  const canManage = usePermission("MANAGER")

  const [confirmFinalizar, setConfirmFinalizar] = useState(false)
  const [confirmCancelar, setConfirmCancelar] = useState(false)

  async function handleFinalizar() {
    try {
      await finalizarMut.mutateAsync()
      toast.success("Contagem finalizada.")
    } catch {
      toast.error("Erro ao finalizar contagem.")
    }
  }

  async function handleCancelar() {
    try {
      await cancelarMut.mutateAsync()
      toast.success("Contagem cancelada.")
    } catch {
      toast.error("Erro ao cancelar contagem.")
    }
  }

  if (isLoading || !contagem) {
    return (
      <div className="p-6 text-muted-foreground text-sm">Carregando contagem...</div>
    )
  }

  const statusBadge = STATUS_BADGE[contagem.status] ?? STATUS_BADGE.aberta
  const tipoBadge = TIPO_BADGE[contagem.tipo] ?? TIPO_BADGE.ciclica
  const editable =
    contagem.status === "aberta" || contagem.status === "em_andamento"

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link
          href={"/estoque" as Route}
          className="hover:text-foreground/60 transition-colors"
        >
          Estoque
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          href={"/estoque/contagens" as Route}
          className="hover:text-foreground/60 transition-colors"
        >
          Contagens
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground/60">#{id.slice(0, 8)}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-primary-500" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">
                Contagem #{id.slice(0, 8)}
              </h1>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${tipoBadge.className}`}
              >
                {tipoBadge.label}
              </span>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${statusBadge.className}`}
              >
                {statusBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span>Aberta em {formatDate(contagem.data_abertura)}</span>
              {contagem.data_fechamento && (
                <span>Fechada em {formatDate(contagem.data_fechamento)}</span>
              )}
              <span>por {contagem.iniciado_por_nome}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="label-mono text-muted-foreground mb-1">TOTAL ITENS</p>
          <p className="text-2xl font-mono font-semibold text-foreground">
            {contagem.total_itens}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="label-mono text-muted-foreground mb-1">CONTADOS</p>
          <p className="text-2xl font-mono font-semibold text-foreground">
            {contagem.total_contados}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="label-mono text-muted-foreground mb-1">DIVERGÊNCIAS</p>
          <p
            className={`text-2xl font-mono font-semibold ${
              contagem.total_divergencias > 0 ? "text-error-400" : "text-foreground"
            }`}
          >
            {contagem.total_divergencias}
          </p>
        </div>
      </div>

      {/* Items table */}
      <div className="section-divider">ITENS</div>

      {contagem.itens.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhum item nesta contagem.
        </div>
      ) : (
        <div className="overflow-x-auto overflow-hidden rounded-md border border-border bg-muted/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  POSIÇÃO
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  ITEM
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-right font-normal">
                  QTD SISTEMA
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-right font-normal">
                  QTD CONTADA
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-right font-normal">
                  DIVERGÊNCIA
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  OBSERVAÇÃO
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  CONTADO POR
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal w-20" />
              </tr>
            </thead>
            <tbody>
              {contagem.itens.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  contagemId={id}
                  editable={editable}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer actions */}
      {editable && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setConfirmCancelar(true)}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground/60 hover:text-foreground hover:border-border transition-colors"
          >
            Cancelar Contagem
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setConfirmFinalizar(true)}
              disabled={finalizarMut.isPending}
              className="rounded-md bg-success-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-success-700 disabled:opacity-50 transition-colors"
            >
              {finalizarMut.isPending ? "Finalizando..." : "Finalizar Contagem"}
            </button>
          )}
        </div>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmFinalizar}
        onOpenChange={setConfirmFinalizar}
        title="Finalizar contagem?"
        description="A contagem será encerrada e as divergências registradas. Esta ação não pode ser desfeita."
        confirmLabel="Finalizar"
        onConfirm={handleFinalizar}
      />
      <ConfirmDialog
        open={confirmCancelar}
        onOpenChange={setConfirmCancelar}
        title="Cancelar contagem?"
        description="A contagem será cancelada e os dados registrados descartados."
        confirmLabel="Cancelar Contagem"
        variant="destructive"
        onConfirm={handleCancelar}
      />
    </div>
  )
}
