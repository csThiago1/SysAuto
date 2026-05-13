"use client"

import { useState, useMemo } from "react"
import {
  ShoppingCart,
  ArrowRight,
  MessageSquare,
  ClipboardList,
  CheckSquare,
  Square,
  PlusCircle,
} from "lucide-react"
import {
  useDashboardCompras,
  usePedidosCompra,
  useIniciarCotacao,
  useCancelarPedido,
  useCotacaoLogs,
  useRespostasCotacao,
  useSelecionarResposta,
} from "@/hooks/usePurchasing"
import type { PedidoCompra, RespostaCotacao, StatusPedidoCompra } from "@paddock/types"
import { toast } from "sonner"
import { QuotationBuilder } from "@/components/purchasing/QuotationBuilder"
import { MontarOCModal } from "@/components/purchasing/MontarOCModal"
import { RespostaForm } from "@/components/purchasing/RespostaForm"

// ─── Status badge config ──────────────────────────────────────────────────────

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

const TIPO_QUALIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  genuina:   { label: "Genuina",   color: "text-success-400" },
  reposicao: { label: "Reposicao", color: "text-info-400" },
  similar:   { label: "Similar",   color: "text-warning-400" },
  usada:     { label: "Usada",     color: "text-muted-foreground" },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
  )
}

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

// ─── Comparison table ─────────────────────────────────────────────────────────

function ComparativoTable({
  pedidos,
  respostas,
  onSelecionar,
}: {
  pedidos: PedidoCompra[]
  respostas: RespostaCotacao[]
  onSelecionar: (respostaId: string) => void
}) {
  const uniqueSuppliers = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of respostas) {
      map.set(r.supplier, r.supplier_name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [respostas])

  if (uniqueSuppliers.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="label-mono text-muted-foreground text-left px-3 py-2">Peca</th>
            {uniqueSuppliers.map((s) => (
              <th key={s.id} className="label-mono text-muted-foreground text-left px-3 py-2">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id} className="border-b border-white/5">
              <td className="px-3 py-2">
                <p className="text-foreground/80">{p.descricao}</p>
                {p.codigo_referencia && (
                  <p className="text-muted-foreground font-mono">{p.codigo_referencia}</p>
                )}
              </td>
              {uniqueSuppliers.map((s) => {
                const resp = respostas.find(
                  (r) => r.pedido_compra === p.id && r.supplier === s.id,
                )
                return (
                  <td
                    key={s.id}
                    className={`px-3 py-2 ${resp?.selecionada ? "bg-success-500/5" : ""}`}
                  >
                    {resp ? (
                      <div className="space-y-0.5">
                        <p className="font-mono font-semibold text-foreground">
                          R$ {Number(resp.valor_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        {resp.prazo_entrega && (
                          <p className="text-muted-foreground">{resp.prazo_entrega}</p>
                        )}
                        {resp.condicoes_pagamento && (
                          <p className="text-muted-foreground">{resp.condicoes_pagamento}</p>
                        )}
                        {resp.selecionada ? (
                          <span className="inline-flex items-center gap-1 text-success-400 font-medium">
                            <CheckSquare size={11} />
                            Selecionado
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelecionar(resp.id)}
                            className="text-info-400 hover:text-info-300 transition-colors flex items-center gap-1"
                          >
                            <Square size={11} />
                            Selecionar
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardCompras()
  const { data: pedidos, isLoading: pedidosLoading } = usePedidosCompra({
    status: "solicitado,em_cotacao,oc_pendente",
  })

  const iniciarCotacao = useIniciarCotacao()
  const cancelarPedido = useCancelarPedido()
  const selecionarResposta = useSelecionarResposta()

  const [actioningId, setActioningId] = useState<string | null>(null)
  const [selectedPedidoIds, setSelectedPedidoIds] = useState<Set<string>>(new Set())
  const [quotationPedidos, setQuotationPedidos] = useState<PedidoCompra[] | null>(null)
  const [montarOCPedido, setMontarOCPedido] = useState<PedidoCompra | null>(null)
  const [respostaFormPedidos, setRespostaFormPedidos] = useState<PedidoCompra[] | null>(null)

  // Detect the service_order of the first selected pedido to load cotacao/resposta data
  const selectedPedidos = useMemo(
    () => pedidos?.filter((p) => selectedPedidoIds.has(p.id)) ?? [],
    [pedidos, selectedPedidoIds],
  )
  const activeServiceOrderId = selectedPedidos[0]?.service_order

  const { data: cotacaoLogs } = useCotacaoLogs(activeServiceOrderId)
  const { data: respostas } = useRespostasCotacao(activeServiceOrderId)

  const pedidosEmComparativo = useMemo(() => {
    if (!respostas?.length || !pedidos) return []
    const idsComResposta = new Set(respostas.map((r) => r.pedido_compra))
    return pedidos.filter((p) => idsComResposta.has(p.id))
  }, [respostas, pedidos])

  function togglePedido(id: string) {
    setSelectedPedidoIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAction(id: string, action: string) {
    setActioningId(id)
    try {
      if (action === "iniciar-cotacao") {
        await iniciarCotacao.mutateAsync(id)
        toast.success("Cotacao iniciada com sucesso.")
      } else if (action === "cancelar") {
        await cancelarPedido.mutateAsync(id)
        toast.success("Pedido cancelado.")
      }
    } catch {
      toast.error("Erro ao executar acao. Tente novamente.")
    } finally {
      setActioningId(null)
    }
  }

  function openQuotationForSelected() {
    if (selectedPedidos.length === 0) {
      toast.warning("Selecione ao menos um pedido para gerar cotacao.")
      return
    }
    setQuotationPedidos(selectedPedidos)
  }

  function openRespostaForSelected() {
    if (selectedPedidos.length === 0) {
      toast.warning("Selecione ao menos um pedido para registrar resposta.")
      return
    }
    setRespostaFormPedidos(selectedPedidos)
  }

  async function handleSelecionar(respostaId: string) {
    try {
      await selecionarResposta.mutateAsync(respostaId)
      toast.success("Resposta selecionada.")
    } catch {
      toast.error("Erro ao selecionar resposta.")
    }
  }

  const hasSelection = selectedPedidoIds.size > 0

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
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

        {hasSelection && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedPedidoIds.size} selecionado(s)
            </span>
            <button
              type="button"
              onClick={openQuotationForSelected}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                         bg-success-500/10 text-success-400 border border-success-500/20
                         hover:bg-success-500/20 transition-colors"
            >
              <MessageSquare size={12} />
              Cotacao WhatsApp
            </button>
            <button
              type="button"
              onClick={openRespostaForSelected}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                         bg-info-500/10 text-info-400 border border-info-500/20
                         hover:bg-info-500/20 transition-colors"
            >
              <PlusCircle size={12} />
              Registrar Resposta
            </button>
          </div>
        )}
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
              <th className="px-4 py-3 w-10" />
              <th className="label-mono text-muted-foreground text-left px-4 py-3">OS</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Peca</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Tipo</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Veiculo</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Status</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Data</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {pedidosLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(8)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted/50 rounded animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !pedidos?.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  Nenhum pedido pendente
                </td>
              </tr>
            ) : (
              pedidos.map((p) => {
                const isSelected = selectedPedidoIds.has(p.id)
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                      actioningId === p.id ? "opacity-50" : ""
                    } ${isSelected ? "bg-info-500/5" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePedido(p.id)}
                        className="w-3.5 h-3.5 rounded border border-border accent-primary cursor-pointer"
                      />
                    </td>
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
                      <TipoQualidadeBadge tipo={p.tipo_qualidade} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{p.veiculo || "--"}</span>
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
                      <RowActions
                        pedido={p}
                        onAction={handleAction}
                        onCotacaoWhatsApp={(pedido) => setQuotationPedidos([pedido])}
                        onMontarOC={setMontarOCPedido}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Comparativo ── */}
      {pedidosEmComparativo.length > 0 && respostas && (
        <>
          <div className="section-divider">COMPARATIVO DE COTACOES</div>
          <div className="bg-muted/50 rounded-md border border-border overflow-hidden">
            <ComparativoTable
              pedidos={pedidosEmComparativo}
              respostas={respostas}
              onSelecionar={handleSelecionar}
            />
          </div>
        </>
      )}

      {/* ── Historico de Cotacoes ── */}
      {cotacaoLogs && cotacaoLogs.length > 0 && (
        <>
          <div className="section-divider">HISTORICO DE COTACOES</div>
          <div className="space-y-1">
            {cotacaoLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="text-foreground/70 font-medium">{log.supplier_name}</span>
                {log.contact_name && <span>({log.contact_name})</span>}
                <span>—</span>
                <span className="font-mono">
                  {new Date(log.created_at).toLocaleDateString("pt-BR")}{" "}
                  {new Date(log.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>por {log.enviado_por_nome?.split("@")[0]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {quotationPedidos && (
        <QuotationBuilder
          pedidos={quotationPedidos}
          open={!!quotationPedidos}
          onOpenChange={(open) => {
            if (!open) setQuotationPedidos(null)
          }}
        />
      )}
      {montarOCPedido && (
        <MontarOCModal
          pedido={montarOCPedido}
          open={!!montarOCPedido}
          onOpenChange={(open) => {
            if (!open) setMontarOCPedido(null)
          }}
        />
      )}
      {respostaFormPedidos && (
        <RespostaForm
          pedidos={respostaFormPedidos}
          open={!!respostaFormPedidos}
          onOpenChange={(open) => {
            if (!open) setRespostaFormPedidos(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Row action button (inline to avoid prop drilling) ────────────────────────

function RowActions({
  pedido,
  onAction,
  onCotacaoWhatsApp,
  onMontarOC,
}: {
  pedido: PedidoCompra
  onAction: (id: string, action: string) => void
  onCotacaoWhatsApp: (pedido: PedidoCompra) => void
  onMontarOC: (pedido: PedidoCompra) => void
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
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onCotacaoWhatsApp(pedido)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                     bg-success-500/10 text-success-400 border border-success-500/20
                     hover:bg-success-500/20 transition-colors"
        >
          <MessageSquare size={11} />
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => onMontarOC(pedido)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                     bg-info-500/10 text-info-400 border border-info-500/20
                     hover:bg-info-500/20 transition-colors"
        >
          <ClipboardList size={11} />
          Montar OC
        </button>
      </div>
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
