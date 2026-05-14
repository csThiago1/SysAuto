"use client"

import { use, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckSquare, Square, XCircle, CheckCircle2, FileText } from "lucide-react"
import { toast } from "sonner"
import {
  useAprovacao,
  usePedidosCompra,
  useRespostasCotacao,
  useAprovarCotacao,
  useRejeitarCotacao,
} from "@/hooks/usePurchasing"
import type { PedidoCompra, RespostaCotacao } from "@paddock/types"

// ─── Rejeitar dialog ──────────────────────────────────────────────────────────

function RejeitarDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (motivo: string) => void
  loading: boolean
}) {
  const [motivo, setMotivo] = useState("")
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-base font-semibold text-foreground mb-1">Rejeitar Cotacao</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Informe o motivo da rejeicao para o comprador.
        </p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo da rejeicao..."
          rows={3}
          className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-md
                     text-foreground placeholder:text-muted-foreground/60 resize-none
                     focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(motivo)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md
                       bg-error-500/10 text-error-400 border border-error-500/20
                       hover:bg-error-500/20 transition-colors disabled:opacity-50"
          >
            <XCircle size={14} />
            {loading ? "Rejeitando..." : "Rejeitar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Preview OC card ──────────────────────────────────────────────────────────

interface PreviewOC {
  supplierName: string
  items: { descricao: string; valor: number; prazo: string; condicao: string }[]
  total: number
}

function PreviewOCCard({ oc }: { oc: PreviewOC }) {
  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
      <p className="text-sm font-medium text-foreground">{oc.supplierName}</p>
      <div className="space-y-1">
        {oc.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-foreground/70 truncate flex-1 mr-2">{item.descricao}</span>
            <div className="flex items-center gap-2 shrink-0">
              {item.prazo && <span className="text-muted-foreground">{item.prazo}</span>}
              <span className="font-mono font-medium text-foreground">
                R${" "}
                {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">Total fornecedor</span>
        <span className="font-mono font-semibold text-sm text-success-400">
          R${" "}
          {oc.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AprovacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: aprovacao, isLoading: aprovLoading } = useAprovacao(id)
  const { data: pedidos } = usePedidosCompra(
    aprovacao?.service_order ? { service_order: aprovacao.service_order } : undefined,
  )
  const { data: respostas } = useRespostasCotacao(aprovacao?.service_order)
  const aprovarCotacao = useAprovarCotacao()
  const rejeitarCotacao = useRejeitarCotacao()

  const [selections, setSelections] = useState<Map<string, string>>(new Map())
  const [observacoes, setObservacoes] = useState("")
  const [showRejeitar, setShowRejeitar] = useState(false)

  // Unique suppliers from responses
  const uniqueSuppliers = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of respostas ?? []) {
      map.set(r.supplier, r.supplier_name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [respostas])

  function selectResponse(pedidoId: string, respostaId: string) {
    setSelections((prev) => {
      const next = new Map(prev)
      if (next.get(pedidoId) === respostaId) {
        next.delete(pedidoId)
      } else {
        next.set(pedidoId, respostaId)
      }
      return next
    })
  }

  const previewOCs = useMemo<PreviewOC[]>(() => {
    const supplierGroups = new Map<string, PreviewOC>()
    for (const [pedidoId, respostaId] of selections) {
      const resp = respostas?.find((r: RespostaCotacao) => r.id === respostaId)
      const pedido = pedidos?.find((p: PedidoCompra) => p.id === pedidoId)
      if (!resp || !pedido) continue
      if (!supplierGroups.has(resp.supplier)) {
        supplierGroups.set(resp.supplier, {
          supplierName: resp.supplier_name,
          items: [],
          total: 0,
        })
      }
      const group = supplierGroups.get(resp.supplier)!
      const valor = Number(resp.valor_unitario) * Number(pedido.quantidade)
      group.items.push({
        descricao: pedido.descricao,
        valor,
        prazo: resp.prazo_entrega,
        condicao: resp.condicoes_pagamento,
      })
      group.total += valor
    }
    return Array.from(supplierGroups.values())
  }, [selections, respostas, pedidos])

  const grandTotal = previewOCs.reduce((sum, oc) => sum + oc.total, 0)

  async function handleAprovar() {
    if (selections.size === 0) {
      toast.warning("Selecione ao menos uma resposta por peca.")
      return
    }
    const selecoes = Array.from(selections.entries()).map(([pedido_compra_id, resposta_cotacao_id]) => ({
      pedido_compra_id,
      resposta_cotacao_id,
    }))
    try {
      const result = await aprovarCotacao.mutateAsync({ id, selecoes, observacoes_financeiro: observacoes })
      toast.success(result.detail)
      router.push("/compras")
    } catch {
      toast.error("Erro ao aprovar cotacao. Tente novamente.")
    }
  }

  async function handleRejeitar(motivo: string) {
    try {
      await rejeitarCotacao.mutateAsync({ id, motivo_rejeicao: motivo })
      toast.success("Cotacao rejeitada.")
      setShowRejeitar(false)
      router.push("/compras")
    } catch {
      toast.error("Erro ao rejeitar. Tente novamente.")
    }
  }

  if (aprovLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted/50 rounded w-64" />
          <div className="h-4 bg-muted/50 rounded w-48" />
        </div>
      </div>
    )
  }

  if (!aprovacao) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Aprovacao nao encontrada.</p>
      </div>
    )
  }

  const osTitle = `OS #${aprovacao.os_number} — ${aprovacao.os_make} ${aprovacao.os_model} ${aprovacao.os_year}`.trim()
  const enviadoPor = aprovacao.enviado_por_nome?.split("@")[0] ?? aprovacao.enviado_por_nome
  const dataEnvio = new Date(aprovacao.created_at).toLocaleDateString("pt-BR")
  const isProcessada = aprovacao.status !== "pendente"

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/compras" className="hover:text-foreground transition-colors">
            Compras
          </Link>
          <span>/</span>
          <span>Aprovacao</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">Aprovacao de Cotacao — {osTitle}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {aprovacao.os_plate && <span>{aprovacao.os_plate} · </span>}
          Solicitado por {enviadoPor} em {dataEnvio}
        </p>
        <div className="flex items-center gap-2 mt-2">
          {aprovacao.status === "pendente" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-slow" />
              Pendente de aprovacao
            </span>
          )}
          {aprovacao.status === "aprovada" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-success-500/10 text-success-400 border border-success-500/20">
              Aprovada
            </span>
          )}
          {aprovacao.status === "rejeitada" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-error-500/10 text-error-400 border border-error-500/20">
              Rejeitada
            </span>
          )}
        </div>
      </div>

      {/* Mensagem se ja processada */}
      {isProcessada && (
        <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm text-muted-foreground">
          Esta aprovacao ja foi processada ({aprovacao.status}).
          {aprovacao.motivo_rejeicao && (
            <p className="mt-1 text-error-400">Motivo: {aprovacao.motivo_rejeicao}</p>
          )}
          {aprovacao.observacoes_financeiro && (
            <p className="mt-1">Obs. financeiro: {aprovacao.observacoes_financeiro}</p>
          )}
        </div>
      )}

      {/* COMPARATIVO COM SELECAO */}
      {!isProcessada && (
        <div>
          <div className="section-divider mb-3">SELECIONAR FORNECEDOR POR PECA</div>
          <p className="text-xs text-muted-foreground mb-3">
            Clique para selecionar o fornecedor de cada peca. Cada fornecedor gerara uma OC separada.
          </p>

          {uniqueSuppliers.length === 0 ? (
            <div className="bg-muted/50 border border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma resposta de fornecedor registrada.</p>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-md border border-border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="label-mono text-muted-foreground text-left px-3 py-2">Peca</th>
                    {uniqueSuppliers.map((s) => (
                      <th key={s.id} className="label-mono text-muted-foreground text-left px-3 py-2 min-w-32">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(pedidos ?? []).map((p: PedidoCompra) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="px-3 py-2">
                        <p className="text-foreground/80">{p.descricao}</p>
                        {p.codigo_referencia && (
                          <p className="text-muted-foreground font-mono">{p.codigo_referencia}</p>
                        )}
                        <p className="text-muted-foreground mt-0.5">Qtd: {p.quantidade}</p>
                      </td>
                      {uniqueSuppliers.map((s) => {
                        const resp = (respostas ?? []).find(
                          (r: RespostaCotacao) => r.pedido_compra === p.id && r.supplier === s.id,
                        )
                        const isSelected = selections.get(p.id) === resp?.id
                        return (
                          <td
                            key={s.id}
                            className={`px-3 py-2 transition-colors ${
                              isSelected ? "bg-success-500/8 border-l-2 border-success-500/40" : ""
                            }`}
                          >
                            {resp ? (
                              <button
                                type="button"
                                onClick={() => selectResponse(p.id, resp.id)}
                                className="w-full text-left space-y-0.5 group"
                              >
                                <p className="font-mono font-semibold text-foreground">
                                  R${" "}
                                  {Number(resp.valor_unitario).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </p>
                                <p className="font-mono text-muted-foreground text-xs">
                                  Total: R${" "}
                                  {(Number(resp.valor_unitario) * Number(p.quantidade)).toLocaleString(
                                    "pt-BR",
                                    { minimumFractionDigits: 2 },
                                  )}
                                </p>
                                {resp.prazo_entrega && (
                                  <p className="text-muted-foreground">{resp.prazo_entrega}</p>
                                )}
                                {resp.condicoes_pagamento && (
                                  <p className="text-muted-foreground">{resp.condicoes_pagamento}</p>
                                )}
                                <span
                                  className={`inline-flex items-center gap-1 mt-1 font-medium transition-colors ${
                                    isSelected
                                      ? "text-success-400"
                                      : "text-muted-foreground/60 group-hover:text-info-400"
                                  }`}
                                >
                                  {isSelected ? (
                                    <>
                                      <CheckSquare size={11} />
                                      Selecionado
                                    </>
                                  ) : (
                                    <>
                                      <Square size={11} />
                                      Selecionar
                                    </>
                                  )}
                                </span>
                              </button>
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
          )}
        </div>
      )}

      {/* PREVIEW OCs */}
      {!isProcessada && previewOCs.length > 0 && (
        <div>
          <div className="section-divider mb-3">
            PREVIEW — {previewOCs.length} ORDEM(NS) DE COMPRA A GERAR
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {previewOCs.map((oc, i) => (
              <PreviewOCCard key={i} oc={oc} />
            ))}
          </div>
          <div className="flex justify-end mt-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Total geral: </span>
              <span className="font-mono font-semibold text-foreground">
                R${" "}
                {grandTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* OBSERVACOES */}
      {!isProcessada && (
        <div>
          <div className="section-divider mb-3">OBSERVACOES (OPCIONAL)</div>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observacoes para o comprador..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-md
                       text-foreground placeholder:text-muted-foreground/60 resize-none
                       focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      )}

      {/* BOTOES */}
      {!isProcessada && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setShowRejeitar(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium
                       bg-error-500/10 text-error-400 border border-error-500/20
                       hover:bg-error-500/20 transition-colors"
          >
            <XCircle size={14} />
            Rejeitar
          </button>
          <button
            type="button"
            onClick={() => void handleAprovar()}
            disabled={selections.size === 0 || aprovarCotacao.isPending}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium
                       bg-success-500/10 text-success-400 border border-success-500/20
                       hover:bg-success-500/20 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={14} />
            {aprovarCotacao.isPending
              ? "Aprovando..."
              : `Aprovar e Gerar OCs (${previewOCs.length})`}
          </button>
        </div>
      )}

      {/* Links para as OCs se ja aprovada */}
      {aprovacao.status === "aprovada" && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            As OCs geradas estao disponiveis na listagem. Use o icone
            <FileText size={12} className="inline mx-1 text-muted-foreground/60" />
            para baixar cada PDF.
          </p>
          <Link
            href={`/compras/ordens?service_order=${aprovacao.service_order}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium
                       bg-success-500/10 text-success-400 border border-success-500/20
                       hover:bg-success-500/20 transition-colors"
          >
            Ver Ordens de Compra
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <RejeitarDialog
        open={showRejeitar}
        onClose={() => setShowRejeitar(false)}
        onConfirm={handleRejeitar}
        loading={rejeitarCotacao.isPending}
      />
    </div>
  )
}
