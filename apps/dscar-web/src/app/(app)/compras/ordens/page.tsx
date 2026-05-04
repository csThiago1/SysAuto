"use client"

import { FileCheck, Plus } from "lucide-react"
import { useOrdensCompra, useCriarOC } from "@/hooks/usePurchasing"
import type { OrdemCompra, StatusOrdemCompra } from "@paddock/types"
import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

// ─── Status badge config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  StatusOrdemCompra,
  { label: string; bg: string; text: string; border: string }
> = {
  rascunho: {
    label: "Rascunho",
    bg: "bg-white/5",
    text: "text-white/40",
    border: "border-white/10",
  },
  pendente_aprovacao: {
    label: "Pend. Aprovacao",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
  aprovada: {
    label: "Aprovada",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
  },
  rejeitada: {
    label: "Rejeitada",
    bg: "bg-error-500/10",
    text: "text-error-400",
    border: "border-error-500/20",
  },
  parcial_recebida: {
    label: "Parcial",
    bg: "bg-warning-500/10",
    text: "text-warning-400",
    border: "border-warning-500/20",
  },
  concluida: {
    label: "Concluida",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
  },
}

function StatusBadge({ status }: { status: StatusOrdemCompra }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-slow" />
      {cfg.label}
    </span>
  )
}

// ─── Nova OC Dialog ──────────────────────────────────────────────────────────────

function NovaOCDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [osId, setOsId] = useState("")
  const criarOC = useCriarOC()

  if (!open) return null

  async function handleCreate() {
    if (!osId.trim()) {
      toast.error("Informe o ID da OS.")
      return
    }
    try {
      await criarOC.mutateAsync({ service_order: osId.trim() })
      toast.success("Ordem de compra criada.")
      setOsId("")
      onClose()
    } catch {
      toast.error("Erro ao criar ordem de compra.")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Fechar"
      />
      <div className="relative bg-[#1c1c1e] border border-white/10 rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold text-white">Nova Ordem de Compra</h2>
        <p className="text-sm text-white/40">
          Informe o ID da OS para criar uma nova OC vinculada.
        </p>
        <input
          type="text"
          placeholder="ID da OS (UUID)"
          value={osId}
          onChange={(e) => setOsId(e.target.value)}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={criarOC.isPending}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {criarOC.isPending ? "Criando..." : "Criar OC"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return "R$ 0,00"
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

// ─── Page ────────────────────────────────────────────────────────────────────────

export default function OrdensCompraPage() {
  const { data: ordens, isLoading } = useOrdensCompra()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
            <FileCheck size={20} className="text-white/60" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Ordens de Compra</h1>
            <p className="text-sm text-white/40">
              {isLoading
                ? "Carregando..."
                : `${ordens?.length ?? 0} ordem${(ordens?.length ?? 0) !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md
                     bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          Nova OC
        </button>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
        <table className="w-full">
          <thead>
            <tr className="bg-white/[0.03] border-b border-white/10">
              <th className="label-mono text-white/40 text-left px-4 py-3">Numero</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">OS</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">Status</th>
              <th className="label-mono text-white/40 text-right px-4 py-3">Valor Total</th>
              <th className="label-mono text-white/40 text-center px-4 py-3">Itens</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">Criado por</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(7)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-white/5 rounded animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !ordens?.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/30 text-sm">
                  Nenhuma ordem de compra encontrada.
                </td>
              </tr>
            ) : (
              ordens.map((oc: OrdemCompra) => (
                <tr
                  key={oc.id}
                  className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/compras/ordens/${oc.id}`}
                      className="font-mono text-sm text-primary-500 font-medium hover:underline"
                    >
                      {oc.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/service-orders/${oc.service_order}`}
                      className="font-mono text-sm text-primary-500/70 hover:text-primary-500 hover:underline"
                    >
                      {oc.os_number ? `#${oc.os_number}` : "--"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={oc.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-white/70">
                      {formatCurrency(oc.valor_total)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-sm text-white/50">
                      {oc.total_itens}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-white/50">
                      {oc.criado_por_nome || "--"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white/40 font-mono">
                      {formatDate(oc.created_at)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Nova OC Dialog ── */}
      <NovaOCDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
