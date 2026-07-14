"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import type { Route } from "next"
import { ShoppingCart, ArrowRight, Clock, Search, Gavel, CheckCircle2 } from "lucide-react"
import { useDashboardCompras, usePedidosCompra, useAprovacoes } from "@/hooks/usePurchasing"
import type { AprovacaoCotacao } from "@paddock/types"
import { ScrollFade } from "@/components/ui/scroll-fade"
import { SectionLabel } from "@/components/ui/section-label"
import { KpiStrip, type KpiItem } from "@/components/ui/kpi-strip"
import { cn } from "@/lib/utils"

// ─── OS-level status config ───────────────────────────────────────────────────
// dot = faixa do card denso | text = texto colorido da linha 1 (mesmo padrão de SERVICE_ORDER_STATUS_CONFIG)

const OS_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  "Solicitado": {
    label: "Solicitado",
    bg: "bg-warning-500/10",
    text: "text-warning-400",
    border: "border-warning-500/20",
    dot: "bg-warning-500",
  },
  "Em cotacao": {
    label: "Em cotacao",
    bg: "bg-info-500/10",
    text: "text-info-400",
    border: "border-info-500/20",
    dot: "bg-info-500",
  },
  "Aguard. aprovacao": {
    label: "Aguard. aprovacao",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
    dot: "bg-purple-500",
  },
  "Aprovada": {
    label: "Aprovada",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
    dot: "bg-success-500",
  },
  "Rejeitada": {
    label: "Rejeitada",
    bg: "bg-error-500/10",
    text: "text-error-400",
    border: "border-error-500/20",
    dot: "bg-error-500",
  },
}

function OSStatusBadge({ label }: { label: string }) {
  const cfg = OS_STATUS_CONFIG[label] ?? OS_STATUS_CONFIG["Solicitado"]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-slow" />
      {cfg.label}
    </span>
  )
}

// ─── OS Row types ─────────────────────────────────────────────────────────────

interface OSRow {
  serviceOrderId: string
  osNumber: number
  vehicle: string
  customerType: string
  customerName: string
  insurerName: string
  totalParts: number
  statusSummary: string
  hasEmCotacao: boolean
  hasSolicitado: boolean
  aprovacaoId?: string
  aprovacaoStatus?: string
}

// ─── Row action ───────────────────────────────────────────────────────────────

function RowAction({ row }: { row: OSRow }) {
  if (row.aprovacaoStatus === "pendente") {
    return (
      <Link
        href={`/compras/aprovacao/${row.aprovacaoId}` as Route}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                   bg-purple-500/10 text-purple-400 border border-purple-500/20
                   hover:bg-purple-500/20 transition-colors"
      >
        Ver Aprovacao
        <ArrowRight size={12} />
      </Link>
    )
  }
  if (row.aprovacaoStatus === "aprovada") {
    return (
      <Link
        href={`/compras/ordens?service_order=${row.serviceOrderId}` as Route}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                   bg-success-500/10 text-success-400 border border-success-500/20
                   hover:bg-success-500/20 transition-colors"
      >
        Ver OCs
        <ArrowRight size={12} />
      </Link>
    )
  }
  if (row.aprovacaoStatus === "rejeitada") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-error-500/10 text-error-400 border border-error-500/20">
          Rejeitada
        </span>
        <Link
          href={`/compras/cotacao/${row.serviceOrderId}` as Route}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                     bg-warning-500/10 text-warning-400 border border-warning-500/20
                     hover:bg-warning-500/20 transition-colors"
        >
          Reenviar
          <ArrowRight size={12} />
        </Link>
      </div>
    )
  }
  if (row.hasSolicitado || row.hasEmCotacao) {
    return (
      <Link
        href={`/compras/cotacao/${row.serviceOrderId}` as Route}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                   bg-info-500/10 text-info-400 border border-info-500/20
                   hover:bg-info-500/20 transition-colors"
      >
        Gerenciar
        <ArrowRight size={12} />
      </Link>
    )
  }
  return <span className="text-xs text-muted-foreground/50">--</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardCompras()
  const { data: pedidos, isLoading: pedidosLoading } = usePedidosCompra({})
  const { data: aprovacoes } = useAprovacoes()

  const osRows = useMemo<OSRow[]>(() => {
    if (!pedidos) return []
    const groups = new Map<string, OSRow>()

    for (const p of pedidos) {
      const key = p.service_order
      if (!groups.has(key)) {
        const aprov = aprovacoes?.find((a: AprovacaoCotacao) => a.service_order === key)
        groups.set(key, {
          serviceOrderId: key,
          osNumber: p.os_number ?? 0,
          vehicle: `${p.os_make ?? ""} ${p.os_model ?? ""} ${p.os_year ?? ""}`.trim(),
          customerType: p.os_customer_type ?? "private",
          customerName: p.os_customer_name ?? "",
          insurerName: p.os_insurer_name ?? "",
          totalParts: 0,
          statusSummary: "",
          hasEmCotacao: false,
          hasSolicitado: false,
          aprovacaoId: aprov?.id,
          aprovacaoStatus: aprov?.status,
        })
      }
      const row = groups.get(key)!
      row.totalParts++
      if (p.status === "em_cotacao") row.hasEmCotacao = true
      if (p.status === "solicitado") row.hasSolicitado = true
    }

    for (const row of groups.values()) {
      if (row.aprovacaoStatus === "pendente") row.statusSummary = "Aguard. aprovacao"
      else if (row.aprovacaoStatus === "aprovada") row.statusSummary = "Aprovada"
      else if (row.aprovacaoStatus === "rejeitada") row.statusSummary = "Rejeitada"
      else if (row.hasEmCotacao) row.statusSummary = "Em cotacao"
      else if (row.hasSolicitado) row.statusSummary = "Solicitado"
      else row.statusSummary = "—"
    }

    return Array.from(groups.values()).sort((a, b) => b.osNumber - a.osNumber)
  }, [pedidos, aprovacoes])

  return (
    <div className="px-0 py-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
          <ShoppingCart size={20} className="text-foreground/60" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Compras</h1>
          <p className="text-sm text-muted-foreground">Pedidos de compra e ordens de compra</p>
        </div>
      </div>

      {/* KPI Strip */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-muted/50 border border-border rounded-lg p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <KpiStrip
          items={[
            { label: "Solicitados", value: String(stats?.solicitados ?? 0), icon: <Clock size={14} />, iconClass: "bg-warning-500/10 text-warning-400" },
            { label: "Em Cotação", value: String(stats?.em_cotacao ?? 0), icon: <Search size={14} />, iconClass: "bg-info-500/10 text-info-400" },
            { label: "Aguard. Aprov.", value: String(stats?.aguardando_aprovacao ?? 0), icon: <Gavel size={14} />, iconClass: "bg-purple-500/10 text-purple-400" },
            { label: "Aprovadas Hoje", value: String(stats?.aprovadas_hoje ?? 0), icon: <CheckCircle2 size={14} />, iconClass: "bg-success-500/10 text-success-400" },
          ] satisfies KpiItem[]}
        />
      )}

      {/* Table */}
      <SectionLabel>ORDENS DE SERVIÇO COM PEÇAS</SectionLabel>

      {pedidosLoading ? (
        <div className="space-y-2 md:hidden">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/50 rounded-md border border-border animate-pulse" />
          ))}
        </div>
      ) : !osRows.length ? (
        <div className="bg-muted/50 rounded-md border border-border py-10 text-center text-muted-foreground text-sm md:hidden">
          Nenhuma OS com pedidos de compra
        </div>
      ) : (
        <div className="space-y-2 md:hidden">
          {osRows.map((row) => {
            const cfg = row.statusSummary !== "—" ? (OS_STATUS_CONFIG[row.statusSummary] ?? OS_STATUS_CONFIG["Solicitado"]) : null
            return (
              <div
                key={row.serviceOrderId}
                className="relative rounded-[11px] bg-card px-3 py-2.5 transition-[transform] duration-150 ease-out active:scale-[0.98]"
              >
                {cfg && <span aria-hidden className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px]", cfg.dot)} />}

                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold text-primary truncate">
                    {row.osNumber ? `#${row.osNumber}` : "--"}
                  </span>
                  <span className={cn("text-[11px] font-semibold shrink-0", cfg ? cfg.text : "text-muted-foreground/50")}>
                    {cfg ? cfg.label : "—"}
                  </span>
                </div>

                <p className="text-[13.5px] font-medium text-foreground truncate mt-0.5">{row.vehicle || "—"}</p>

                <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2.5 items-baseline mt-[5px] font-mono text-[11.5px] tabular-nums text-muted-foreground">
                  <span className="truncate">{row.insurerName ? row.insurerName : "Particular"}</span>
                  <span className="text-right text-foreground font-semibold text-[12.5px]">
                    {row.totalParts} {row.totalParts === 1 ? "peça" : "peças"}
                  </span>
                </div>

                <div className="flex justify-end pt-1">
                  <RowAction row={row} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="hidden md:block bg-muted/50 rounded-md border border-border">
        <ScrollFade>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="label-mono text-muted-foreground text-left px-4 py-3">OS</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Veiculo</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Tipo</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Pecas</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Status</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Acao</th>
            </tr>
          </thead>
          <tbody>
            {pedidosLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(6)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted/50 rounded animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !osRows.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  Nenhuma OS com pedidos de compra
                </td>
              </tr>
            ) : (
              osRows.map((row) => (
                <tr
                  key={row.serviceOrderId}
                  className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-primary font-medium">
                      {row.osNumber ? `#${row.osNumber}` : "--"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground/80">{row.vehicle || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {row.insurerName ? row.insurerName : "Particular"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted border border-border text-foreground/70">
                      {row.totalParts} {row.totalParts === 1 ? "peca" : "pecas"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.statusSummary !== "—" ? (
                      <OSStatusBadge label={row.statusSummary} />
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RowAction row={row} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </ScrollFade>
      </div>
    </div>
  )
}
