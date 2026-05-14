"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { ShoppingCart, ArrowRight } from "lucide-react"
import {
  useDashboardCompras,
  usePedidosCompra,
  useIniciarCotacao,
} from "@/hooks/usePurchasing"
import type { PedidoCompra, StatusPedidoCompra } from "@paddock/types"
import { toast } from "sonner"

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  solicitado: {
    label: "Solicitado",
    bg: "bg-warning-500/10",
    text: "text-warning-400",
    border: "border-warning-500/20",
  },
  em_cotacao: {
    label: "Em Cotacao",
    bg: "bg-info-500/10",
    text: "text-info-400",
    border: "border-info-500/20",
  },
  oc_pendente: {
    label: "OC Pendente",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
  aprovado: {
    label: "Aprovado",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
  },
  comprado: {
    label: "Comprado",
    bg: "bg-info-500/10",
    text: "text-info-400",
    border: "border-info-500/20",
  },
  recebido: {
    label: "Recebido",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
  },
  cancelado: {
    label: "Cancelado",
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    border: "border-border",
  },
}

function StatusBadge({ status }: { status: StatusPedidoCompra }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.solicitado
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-slow" />
      {cfg.label}
    </span>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: "warning" | "info" | "purple" | "success"
}) {
  const colorMap = {
    warning: {
      bg: "bg-warning-500/10",
      border: "border-warning-500/15",
      label: "text-warning-400",
      value: "text-warning-400",
    },
    info: {
      bg: "bg-info-500/10",
      border: "border-info-500/15",
      label: "text-info-400",
      value: "text-info-400",
    },
    purple: {
      bg: "bg-purple-500/10",
      border: "border-purple-500/15",
      label: "text-purple-400",
      value: "text-purple-400",
    },
    success: {
      bg: "bg-success-500/10",
      border: "border-success-500/15",
      label: "text-success-400",
      value: "text-success-400",
    },
  }
  const c = colorMap[color]
  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-4`}>
      <p className={`label-mono ${c.label}`}>{label}</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${c.value}`}>{value}</p>
    </div>
  )
}

// ─── Row action ───────────────────────────────────────────────────────────────

function RowAction({
  pedido,
  onIniciar,
  actioningId,
}: {
  pedido: PedidoCompra
  onIniciar: (id: string) => void
  actioningId: string | null
}) {
  if (pedido.status === "solicitado") {
    return (
      <button
        type="button"
        disabled={actioningId === pedido.id}
        onClick={() => onIniciar(pedido.id)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                   bg-warning-500/10 text-warning-400 border border-warning-500/20
                   hover:bg-warning-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Iniciar Cotacao
        <ArrowRight size={12} />
      </button>
    )
  }
  if (pedido.status === "em_cotacao") {
    return (
      <Link
        href={`/compras/cotacao/${pedido.service_order}`}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                   bg-info-500/10 text-info-400 border border-info-500/20
                   hover:bg-info-500/20 transition-colors"
      >
        Gerenciar Cotacoes
        <ArrowRight size={12} />
      </Link>
    )
  }
  if (pedido.status === "oc_pendente") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-muted/50 text-muted-foreground border border-border">
        OC gerada
      </span>
    )
  }
  return <span className="text-xs text-muted-foreground/50">--</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface OSGroup {
  osNumber: number
  vehicle: string
  serviceOrderId: string
  pedidos: PedidoCompra[]
}

export default function ComprasPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardCompras()
  const { data: pedidos, isLoading: pedidosLoading } = usePedidosCompra({
    status: "solicitado,em_cotacao,oc_pendente",
  })
  const iniciarCotacao = useIniciarCotacao()
  const [actioningId, setActioningId] = useState<string | null>(null)

  const pedidosByOS = useMemo<OSGroup[]>(() => {
    if (!pedidos) return []
    const groups = new Map<string, OSGroup>()
    for (const p of pedidos) {
      const key = p.service_order
      if (!groups.has(key)) {
        groups.set(key, {
          osNumber: p.os_number ?? 0,
          vehicle: `${p.os_make ?? ""} ${p.os_model ?? ""} ${p.os_year ?? ""}`.trim(),
          serviceOrderId: p.service_order,
          pedidos: [],
        })
      }
      groups.get(key)!.pedidos.push(p)
    }
    return Array.from(groups.values()).sort((a, b) => b.osNumber - a.osNumber)
  }, [pedidos])

  async function handleIniciar(id: string) {
    setActioningId(id)
    try {
      await iniciarCotacao.mutateAsync(id)
      toast.success("Cotacao iniciada com sucesso.")
    } catch {
      toast.error("Erro ao iniciar cotacao. Tente novamente.")
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
          <ShoppingCart size={20} className="text-foreground/60" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de compra e ordens de compra
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {statsLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-muted/50 border border-border rounded-lg p-4 animate-pulse h-20"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Solicitados" value={stats?.solicitados ?? 0} color="warning" />
          <KPICard label="Em Cotacao" value={stats?.em_cotacao ?? 0} color="info" />
          <KPICard label="Aguard. Aprovacao" value={stats?.aguardando_aprovacao ?? 0} color="purple" />
          <KPICard label="Aprovadas Hoje" value={stats?.aprovadas_hoje ?? 0} color="success" />
        </div>
      )}

      {/* ── Section divider ── */}
      <div className="section-divider">PEDIDOS PENDENTES</div>

      {/* ── Table ── */}
      <div className="bg-muted/50 rounded-md border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="label-mono text-muted-foreground text-left px-4 py-3">OS</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Peca</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Tipo</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Status</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Data</th>
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
            ) : !pedidosByOS.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  Nenhum pedido pendente
                </td>
              </tr>
            ) : (
              pedidosByOS.map((group) => (
                <React.Fragment key={group.serviceOrderId}>
                  {group.pedidos.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                        actioningId === p.id ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-primary font-medium">
                          {p.os_number ? `#${p.os_number}` : "--"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground/70">{p.descricao}</span>
                        {p.codigo_referencia && (
                          <span className="ml-1.5 text-xs text-muted-foreground font-mono">
                            {p.codigo_referencia}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {p.tipo_qualidade_display}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RowAction
                          pedido={p}
                          onIniciar={handleIniciar}
                          actioningId={actioningId}
                        />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
