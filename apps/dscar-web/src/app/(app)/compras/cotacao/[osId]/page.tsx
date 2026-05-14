"use client"

import { use, useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight, MessageSquare, PlusCircle, ClipboardList, CheckSquare, Square } from "lucide-react"
import { toast } from "sonner"
import {
  usePedidosCompra,
  useRespostasCotacao,
  useCotacaoLogs,
  useIniciarCotacao,
  useSelecionarResposta,
} from "@/hooks/usePurchasing"
import type { PedidoCompra, RespostaCotacao, StatusPedidoCompra } from "@paddock/types"
import { QuotationBuilder } from "@/components/purchasing/QuotationBuilder"
import { RespostaForm } from "@/components/purchasing/RespostaForm"
import { MontarOCModal } from "@/components/purchasing/MontarOCModal"

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

// ─── Comparativo table ────────────────────────────────────────────────────────

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
                          R${" "}
                          {Number(resp.valor_unitario).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
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

export default function CotacaoOSPage({
  params,
}: {
  params: Promise<{ osId: string }>
}) {
  const { osId } = use(params)

  const { data: pedidos, isLoading } = usePedidosCompra({ service_order: osId })
  const { data: respostas } = useRespostasCotacao(osId)
  const { data: cotacaoLogs } = useCotacaoLogs(osId)
  const iniciarCotacao = useIniciarCotacao()
  const selecionarResposta = useSelecionarResposta()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showQuotation, setShowQuotation] = useState(false)
  const [showResposta, setShowResposta] = useState(false)
  const [montarOCPedido, setMontarOCPedido] = useState<PedidoCompra | null>(null)

  const selectedPedidos = useMemo(
    () => pedidos?.filter((p) => selectedIds.has(p.id)) ?? [],
    [pedidos, selectedIds],
  )

  const pedidosEmCotacao = useMemo(
    () => pedidos?.filter((p) => p.status === "em_cotacao") ?? [],
    [pedidos],
  )

  const pedidosComResposta = useMemo(() => {
    if (!respostas?.length || !pedidos) return []
    const ids = new Set(respostas.map((r) => r.pedido_compra))
    return pedidos.filter((p) => ids.has(p.id))
  }, [respostas, pedidos])

  function togglePedido(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllEmCotacao() {
    if (!pedidos) return
    setSelectedIds(new Set(pedidos.filter((p) => p.status === "em_cotacao").map((p) => p.id)))
  }

  async function handleIniciarTodos() {
    const solicitados = pedidos?.filter((p) => p.status === "solicitado") ?? []
    if (!solicitados.length) return
    try {
      for (const p of solicitados) {
        await iniciarCotacao.mutateAsync(p.id)
      }
      toast.success(`${solicitados.length} pedido(s) em cotacao.`)
    } catch {
      toast.error("Erro ao iniciar cotacao. Tente novamente.")
    }
  }

  async function handleSelecionar(respostaId: string) {
    try {
      await selecionarResposta.mutateAsync(respostaId)
      toast.success("Resposta selecionada.")
    } catch {
      toast.error("Erro ao selecionar resposta.")
    }
  }

  function handleMontarOC() {
    const selectedResp = respostas?.find((r) => r.selecionada)
    const pedido = pedidos?.find((p) => p.id === selectedResp?.pedido_compra)
    if (pedido) setMontarOCPedido(pedido)
  }

  const firstPedido = pedidos?.[0]
  const osTitle = firstPedido
    ? `OS #${firstPedido.os_number} · ${firstPedido.os_make} ${firstPedido.os_model} ${firstPedido.os_year}`.trim()
    : "Carregando..."

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* ── Header com breadcrumb ── */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/compras" className="hover:text-foreground transition-colors">
            Compras
          </Link>
          <span>/</span>
          <span>Cotacoes</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">{osTitle}</h1>
        {firstPedido?.os_plate && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Placa: {firstPedido.os_plate}
          </p>
        )}
      </div>

      {/* ── PECAS SOLICITADAS ── */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="section-divider flex-1">PECAS SOLICITADAS</div>
          {pedidosEmCotacao.length > 0 && (
            <button
              type="button"
              onClick={selectAllEmCotacao}
              className="text-xs text-info-400 hover:text-info-300 transition-colors shrink-0"
            >
              Selecionar em cotacao
            </button>
          )}
        </div>

        <div className="bg-muted/50 rounded-md border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 w-8" />
                <th className="label-mono text-muted-foreground text-left px-3 py-2">Peca</th>
                <th className="label-mono text-muted-foreground text-left px-3 py-2">Ref</th>
                <th className="label-mono text-muted-foreground text-left px-3 py-2">Qtd</th>
                <th className="label-mono text-muted-foreground text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {[...Array(5)].map((__, j) => (
                      <td key={j} className="px-3 py-2">
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !pedidos?.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-sm">
                    Nenhuma peca encontrada para esta OS.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-white/5 transition-colors ${
                      selectedIds.has(p.id) ? "bg-info-500/5" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => togglePedido(p.id)}
                        disabled={p.status === "solicitado"}
                        className="w-3.5 h-3.5 rounded border border-border accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>
                    <td className="px-3 py-2 text-sm text-foreground/80">{p.descricao}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                      {p.codigo_referencia || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground/70 font-mono">
                      {p.quantidade}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Botoes de acao */}
        <div className="flex items-center gap-2 mt-3">
          {selectedPedidos.length > 0 && (
            <button
              type="button"
              onClick={() => setShowQuotation(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                         bg-success-500/10 text-success-400 border border-success-500/20
                         hover:bg-success-500/20 transition-colors"
            >
              <MessageSquare size={12} />
              Cotacao WhatsApp ({selectedPedidos.length}{" "}
              {selectedPedidos.length === 1 ? "peca" : "pecas"})
            </button>
          )}
          {pedidos?.some((p) => p.status === "solicitado") && (
            <button
              type="button"
              onClick={() => void handleIniciarTodos()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                         bg-warning-500/10 text-warning-400 border border-warning-500/20
                         hover:bg-warning-500/20 transition-colors"
            >
              <ArrowRight size={12} />
              Iniciar Cotacao (todos solicitados)
            </button>
          )}
        </div>
      </div>

      {/* ── RESPOSTAS DOS FORNECEDORES ── */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="section-divider flex-1">RESPOSTAS DOS FORNECEDORES</div>
          <button
            type="button"
            onClick={() => setShowResposta(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                       bg-info-500/10 text-info-400 border border-info-500/20
                       hover:bg-info-500/20 transition-colors shrink-0"
          >
            <PlusCircle size={12} />
            Registrar Resposta
          </button>
        </div>

        {pedidosComResposta.length > 0 && respostas ? (
          <div className="bg-muted/50 rounded-md border border-border overflow-hidden">
            <ComparativoTable
              pedidos={pedidosComResposta}
              respostas={respostas}
              onSelecionar={handleSelecionar}
            />
          </div>
        ) : (
          <div className="bg-muted/50 rounded-md border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma resposta registrada ainda.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Envie cotacoes via WhatsApp e registre as respostas dos fornecedores.
            </p>
          </div>
        )}
      </div>

      {/* ── HISTORICO DE ENVIOS ── */}
      {cotacaoLogs && cotacaoLogs.length > 0 && (
        <div>
          <div className="section-divider mb-3">HISTORICO DE ENVIOS</div>
          <div className="space-y-1.5">
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
        </div>
      )}

      {/* ── ACAO FINAL ── */}
      {respostas?.some((r) => r.selecionada) && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleMontarOC}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium
                       bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ClipboardList size={14} />
            Montar OC com selecionados
          </button>
        </div>
      )}

      {/* ── Modais ── */}
      {showQuotation && (
        <QuotationBuilder
          pedidos={selectedPedidos}
          open={showQuotation}
          onOpenChange={setShowQuotation}
        />
      )}
      {showResposta && pedidosEmCotacao.length > 0 && (
        <RespostaForm
          pedidos={pedidosEmCotacao}
          open={showResposta}
          onOpenChange={setShowResposta}
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
    </div>
  )
}
