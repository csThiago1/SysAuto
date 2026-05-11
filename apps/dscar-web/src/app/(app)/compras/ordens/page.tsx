"use client"

import { FileCheck, Plus } from "lucide-react"
import { useOrdensCompra, useCriarOC } from "@/hooks/usePurchasing"
import type { OrdemCompra, StatusOrdemCompra } from "@paddock/types"
import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatDate, formatCurrency } from "@paddock/utils"

// ─── Status badge config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  StatusOrdemCompra,
  { label: string; bg: string; text: string; border: string }
> = {
  rascunho: {
    label: "Rascunho",
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    border: "border-border",
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
  const [osInput, setOsInput] = useState("")
  const [error, setError] = useState("")
  const criarOC = useCriarOC()

  async function handleCreate() {
    const value = osInput.trim()
    if (!value) {
      setError("Informe o número da OS.")
      return
    }
    setError("")

    try {
      let serviceOrderId = value

      // Se o input é um número (não UUID), resolve o UUID via API
      if (/^\d+$/.test(value)) {
        const res = await fetch(`/api/proxy/service-orders/${value}/`)
        if (!res.ok) {
          setError(`OS #${value} não encontrada.`)
          return
        }
        const data = await res.json()
        serviceOrderId = data.id
      }

      await criarOC.mutateAsync({ service_order: serviceOrderId })
      toast.success("Ordem de compra criada.")
      setOsInput("")
      onClose()
    } catch {
      toast.error("Erro ao criar ordem de compra.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setError("") } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Compra</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Informe o numero da OS para criar uma nova OC vinculada.
        </p>
        <div>
          <input
            type="text"
            placeholder="Numero da OS (ex: 42)"
            data-testid="nova-oc-os-input"
            value={osInput}
            onChange={(e) => { setOsInput(e.target.value); setError("") }}
            className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border"
          />
          {error && (
            <p className="mt-1 text-xs text-error-500">{error}</p>
          )}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground/70 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={criarOC.isPending}
            data-testid="nova-oc-submit"
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {criarOC.isPending ? "Criando..." : "Criar OC"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
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
          <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
            <FileCheck size={20} className="text-foreground/60" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Ordens de Compra</h1>
            <p className="text-sm text-muted-foreground">
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
                     bg-primary text-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Nova OC
        </button>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-md border border-border bg-muted/50">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Numero</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">OS</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Status</th>
              <th className="label-mono text-muted-foreground text-right px-4 py-3">Valor Total</th>
              <th className="label-mono text-muted-foreground text-center px-4 py-3">Itens</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Criado por</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(7)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted/50 rounded animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !ordens?.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  Nenhuma ordem de compra encontrada.
                </td>
              </tr>
            ) : (
              ordens.map((oc: OrdemCompra) => (
                <tr
                  key={oc.id}
                  className="border-b border-white/5 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/compras/ordens/${oc.id}`}
                      className="font-mono text-sm text-primary font-medium hover:underline"
                    >
                      {oc.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/os/${oc.os_number}`}
                      className="font-mono text-sm text-primary/70 hover:text-primary hover:underline"
                    >
                      {oc.os_number ? `#${oc.os_number}` : "--"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={oc.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm text-foreground/70">
                      {formatCurrency(oc.valor_total)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-sm text-muted-foreground">
                      {oc.total_itens}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {oc.criado_por_nome || "--"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground font-mono">
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
