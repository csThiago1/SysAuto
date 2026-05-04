"use client"

import { ShoppingCart, ArrowRight } from "lucide-react"
import { useDashboardCompras, usePedidosCompra, useIniciarCotacao } from "@/hooks/usePurchasing"
import type { PedidoCompra, StatusPedidoCompra } from "@paddock/types"
import { useState } from "react"

// ─── Status badge config ────────────────────────────────────────────────────────

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
    bg: "bg-white/5",
    text: "text-white/40",
    border: "border-white/10",
  },
}

const TIPO_QUALIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  genuina:    { label: "Genuina",    color: "text-success-400" },
  reposicao:  { label: "Reposicao",  color: "text-info-400" },
  similar:    { label: "Similar",    color: "text-warning-400" },
  usada:      { label: "Usada",      color: "text-white/40" },
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

function TipoQualidadeBadge({ tipo }: { tipo: string }) {
  const cfg = TIPO_QUALIDADE_CONFIG[tipo] ?? TIPO_QUALIDADE_CONFIG.similar
  return (
    <span className={`text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

// ─── KPI Card ───────────────────────────────────────────────────────────────────

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

// ─── Action Button ──────────────────────────────────────────────────────────────

function ActionButton({
  pedido,
  onAction,
}: {
  pedido: PedidoCompra
  onAction: (id: string, action: string) => void
}) {
  if (pedido.status === "solicitado") {
    return (
      <button
        type="button"
        onClick={() => onAction(pedido.id, "iniciar-cotacao")}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                   bg-warning-500/10 text-warning-400 border border-warning-500/20
                   hover:bg-warning-500/20 transition-colors"
      >
        Iniciar Cotacao
        <ArrowRight size={12} />
      </button>
    )
  }
  if (pedido.status === "em_cotacao") {
    return (
      <button
        type="button"
        onClick={() => onAction(pedido.id, "montar-oc")}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                   bg-info-500/10 text-info-400 border border-info-500/20
                   hover:bg-info-500/20 transition-colors"
      >
        Montar OC
        <ArrowRight size={12} />
      </button>
    )
  }
  return <span className="text-xs text-white/20">--</span>
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardCompras()
  const { data: pedidos, isLoading: pedidosLoading } = usePedidosCompra({
    status: "solicitado,em_cotacao,oc_pendente",
  })

  const [actioningId, setActioningId] = useState<string | null>(null)

  function handleAction(id: string, action: string) {
    setActioningId(id)
    // Actions will be wired to mutations in the detail pages
    // For now we just show visual feedback
    setTimeout(() => setActioningId(null), 500)
    void action // placeholder
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
          <ShoppingCart size={20} className="text-white/60" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Compras</h1>
          <p className="text-sm text-white/40">
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
              className="bg-white/5 border border-white/10 rounded-lg p-4 animate-pulse h-20"
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
      <div className="bg-white/5 rounded-md border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="label-mono text-white/40 text-left px-4 py-3">OS</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">Peca</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">Tipo</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">Veiculo</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">Status</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">Data</th>
              <th className="label-mono text-white/40 text-left px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {pedidosLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(7)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-white/5 rounded animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !pedidos?.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/30 text-sm">
                  Nenhum pedido pendente
                </td>
              </tr>
            ) : (
              pedidos.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                    actioningId === p.id ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-primary-500 font-medium">
                      {p.os_number ? `#${p.os_number}` : "--"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-white/70">{p.descricao}</span>
                    {p.codigo_referencia && (
                      <span className="ml-1.5 text-xs text-white/30 font-mono">
                        {p.codigo_referencia}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TipoQualidadeBadge tipo={p.tipo_qualidade} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-white/50">{p.veiculo || "--"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white/40 font-mono">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionButton pedido={p} onAction={handleAction} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
