"use client"

import { FileCheck, Plus, FileText } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { formatDate, formatCurrency } from "@paddock/utils"
import { ScrollFade } from "@/components/ui/scroll-fade"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ─── Status badge config ────────────────────────────────────────────────────────
// dot = faixa do card denso (mobile) | text = texto colorido da linha 1

const STATUS_CONFIG: Record<
  StatusOrdemCompra,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  rascunho: {
    label: "Rascunho",
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    border: "border-border",
    dot: "bg-muted-foreground",
  },
  pendente_aprovacao: {
    label: "Pend. Aprovacao",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
    dot: "bg-purple-500",
  },
  aprovada: {
    label: "Aprovada",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
    dot: "bg-success-500",
  },
  rejeitada: {
    label: "Rejeitada",
    bg: "bg-error-500/10",
    text: "text-error-400",
    border: "border-error-500/20",
    dot: "bg-error-500",
  },
  parcial_recebida: {
    label: "Parcial",
    bg: "bg-warning-500/10",
    text: "text-warning-400",
    border: "border-warning-500/20",
    dot: "bg-warning-500",
  },
  concluida: {
    label: "Concluida",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
    dot: "bg-success-500",
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
          <Input
            type="text"
            placeholder="Numero da OS (ex: 42)"
            data-testid="nova-oc-os-input"
            value={osInput}
            onChange={(e) => { setOsInput(e.target.value); setError("") }}
            className="w-full"
          />
          {error && (
            <p className="mt-1 text-xs text-error-400">{error}</p>
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
          <Button
            type="button"
            onClick={handleCreate}
            disabled={criarOC.isPending}
            data-testid="nova-oc-submit"
          >
            {criarOC.isPending ? "Criando..." : "Criar OC"}
          </Button>
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
    <div className="px-0 py-3 md:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
            <FileCheck size={20} className="text-foreground/60" />
          </div>
          <div>
            <h1 className="page-title">Ordens de Compra</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Carregando..."
                : `${ordens?.length ?? 0} ordem${(ordens?.length ?? 0) !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => setDialogOpen(true)}
        >
          <Plus size={16} />
          Nova OC
        </Button>
      </div>

      {/* ── Mobile cards ── */}
      {isLoading ? (
        <div className="space-y-2 md:hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/50 rounded-md border border-border animate-pulse" />
          ))}
        </div>
      ) : !ordens?.length ? (
        <div className="bg-muted/50 rounded-md border border-border py-10 text-center text-muted-foreground text-sm md:hidden">
          Nenhuma ordem de compra encontrada.
        </div>
      ) : (
        <div className="space-y-2 md:hidden">
          {ordens.map((oc: OrdemCompra) => {
            const cfg = STATUS_CONFIG[oc.status] ?? STATUS_CONFIG.rascunho
            return (
              <Link
                key={oc.id}
                href={`/compras/ordens/${oc.id}`}
                className="relative block rounded-md bg-card px-3 py-2.5 transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] hover:bg-primary/5"
              >
                <span aria-hidden className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px]", cfg.dot)} />

                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold text-primary truncate">
                    {oc.numero}
                    {oc.os_number && <span className="font-normal text-muted-foreground"> · OS #{oc.os_number}</span>}
                  </span>
                  <span className={cn("text-[11px] font-semibold shrink-0", cfg.text)}>{cfg.label}</span>
                </div>

                <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                  {oc.criado_por_nome || "--"} · {oc.total_itens} {oc.total_itens === 1 ? "item" : "itens"}
                </p>

                <div className="grid grid-cols-[minmax(0,1fr)_112px_78px] gap-2.5 items-baseline mt-[5px] font-mono text-[11.5px] tabular-nums text-muted-foreground">
                  <a
                    href={`/api/proxy/purchasing/ordens-compra/${oc.id}/pdf/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex min-h-11 items-center gap-1 -my-2.5 text-muted-foreground/70 hover:text-foreground/70 transition-colors"
                  >
                    <FileText size={14} />
                    PDF
                  </a>
                  <span className="text-right text-foreground font-semibold text-[12.5px]">
                    {formatCurrency(oc.valor_total)}
                  </span>
                  <span className="text-right">{formatDate(oc.created_at)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Table ── */}
      <div className="hidden md:block rounded-md border border-border bg-muted/50">
        <ScrollFade>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-border">
              <TableHead className="py-3">Numero</TableHead>
              <TableHead className="py-3">OS</TableHead>
              <TableHead className="py-3">Status</TableHead>
              <TableHead className="text-right py-3">Valor Total</TableHead>
              <TableHead className="text-center py-3">Itens</TableHead>
              <TableHead className="py-3">Criado por</TableHead>
              <TableHead className="py-3">Data</TableHead>
              <TableHead className="text-center py-3">PDF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i} className="border-white/5">
                  {[...Array(8)].map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted/50 rounded animate-pulse w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !ordens?.length ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground text-sm">
                  Nenhuma ordem de compra encontrada.
                </TableCell>
              </TableRow>
            ) : (
              ordens.map((oc: OrdemCompra) => (
                <TableRow
                  key={oc.id}
                  className="border-white/5 cursor-pointer"
                >
                  <TableCell>
                    <Link
                      href={`/compras/ordens/${oc.id}`}
                      className="font-mono text-sm text-primary font-medium hover:underline"
                    >
                      {oc.numero}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/os/${oc.os_number}`}
                      className="font-mono text-sm text-primary/70 hover:text-primary hover:underline"
                    >
                      {oc.os_number ? `#${oc.os_number}` : "--"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={oc.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm text-foreground/70">
                      {formatCurrency(oc.valor_total)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-sm text-muted-foreground">
                      {oc.total_itens}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {oc.criado_por_nome || "--"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDate(oc.created_at)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <a
                      href={`/api/proxy/purchasing/ordens-compra/${oc.id}/pdf/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Baixar PDF"
                      className="inline-flex items-center justify-center p-1.5 rounded text-muted-foreground/50
                                 hover:text-foreground/70 hover:bg-muted transition-colors"
                    >
                      <FileText size={14} />
                    </a>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </ScrollFade>
      </div>

      {/* ── Nova OC Dialog ── */}
      <NovaOCDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
