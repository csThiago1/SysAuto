"use client"

import { useState } from "react"
import type {
  OrdemCompraDetail as OrdemCompraDetailType,
  ItemOrdemCompra,
  StatusOrdemCompra,
} from "@paddock/types"
import { formatCurrency } from "@paddock/utils"
import { usePermission } from "@/hooks/usePermission"
import { TipoQualidadeBadge } from "@/components/purchasing/TipoQualidadeBadge"
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Package,
  Truck,
} from "lucide-react"

// ─── OC Status config ─────────────────────────────────────────────────────────

const OC_STATUS_CONFIG: Record<
  StatusOrdemCompra,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  rascunho: {
    label: "Rascunho",
    bg: "bg-white/5",
    text: "text-white/50",
    border: "border-white/10",
    dot: "bg-white/50",
  },
  pendente_aprovacao: {
    label: "Pendente Aprovacao",
    bg: "bg-warning-500/10",
    text: "text-warning-400",
    border: "border-warning-500/20",
    dot: "bg-warning-400",
  },
  aprovada: {
    label: "Aprovada",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
    dot: "bg-success-400",
  },
  rejeitada: {
    label: "Rejeitada",
    bg: "bg-error-500/10",
    text: "text-error-400",
    border: "border-error-500/20",
    dot: "bg-error-400",
  },
  parcial_recebida: {
    label: "Parcial Recebida",
    bg: "bg-info-500/10",
    text: "text-info-400",
    border: "border-info-500/20",
    dot: "bg-info-400",
  },
  concluida: {
    label: "Concluida",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
    dot: "bg-success-400",
  },
}

function OCStatusBadge({ status }: { status: StatusOrdemCompra }) {
  const cfg = OC_STATUS_CONFIG[status] ?? OC_STATUS_CONFIG.rascunho
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse-slow ${cfg.dot}`}
      />
      {cfg.label}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByFornecedor(itens: ItemOrdemCompra[]): Record<string, ItemOrdemCompra[]> {
  const groups: Record<string, ItemOrdemCompra[]> = {}
  for (const item of itens) {
    const key = item.fornecedor_nome || "Sem fornecedor"
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

function uniqueSupplierCount(itens: ItemOrdemCompra[]): number {
  const names = new Set(itens.map((i) => i.fornecedor_nome || "Sem fornecedor"))
  return names.size
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OrdemCompraDetailProps {
  oc: OrdemCompraDetailType
  onAprovar?: () => void
  onRejeitar?: (motivo: string) => void
  isApproving?: boolean
  isRejecting?: boolean
}

export function OrdemCompraDetail({
  oc,
  onAprovar,
  onRejeitar,
  isApproving = false,
  isRejecting = false,
}: OrdemCompraDetailProps) {
  const canApprove = usePermission("MANAGER")
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [motivoRejeicao, setMotivoRejeicao] = useState("")

  const fornecedorGroups = groupByFornecedor(oc.itens)
  const supplierCount = uniqueSupplierCount(oc.itens)

  function handleRejeitar(): void {
    if (!motivoRejeicao.trim()) return
    onRejeitar?.(motivoRejeicao.trim())
    setMotivoRejeicao("")
    setShowRejectInput(false)
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white font-mono">
              {oc.numero}
            </h2>
            <OCStatusBadge status={oc.status} />
          </div>

          <div className="flex items-center gap-4 text-sm text-white/40">
            {oc.os_number && (
              <span className="flex items-center gap-1">
                <FileText size={14} className="text-primary-500" />
                <span className="font-mono text-primary-500">
                  OS #{oc.os_number}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {new Date(oc.created_at).toLocaleDateString("pt-BR")}
            </span>
            {oc.criado_por_nome && (
              <span>por {oc.criado_por_nome}</span>
            )}
          </div>

          {oc.aprovado_por_nome && oc.aprovado_em && (
            <p className="text-xs text-success-400">
              Aprovado por {oc.aprovado_por_nome} em{" "}
              {new Date(oc.aprovado_em).toLocaleDateString("pt-BR")}
            </p>
          )}

          {oc.motivo_rejeicao && (
            <p className="text-xs text-error-400">
              Rejeitado: {oc.motivo_rejeicao}
            </p>
          )}
        </div>
      </div>

      {/* ── Items grouped by fornecedor ── */}
      {Object.entries(fornecedorGroups).map(([fornecedorNome, items], idx) => {
        const firstItem = items[0]
        const groupTotal = items.reduce(
          (sum, i) => sum + parseFloat(i.valor_total || "0"),
          0
        )

        return (
          <div key={fornecedorNome} className="space-y-0">
            {/* Section divider */}
            <div className="section-divider">{`FORNECEDOR ${idx + 1}`}</div>

            {/* Fornecedor info bar */}
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-t-lg px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck size={16} className="text-white/30" />
                <span className="text-sm font-medium text-white/70">
                  {fornecedorNome}
                </span>
                {firstItem?.fornecedor_cnpj && (
                  <span className="text-xs font-mono text-white/30">
                    {firstItem.fornecedor_cnpj}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {firstItem?.fornecedor_contato && (
                  <span className="text-xs text-white/30">
                    {firstItem.fornecedor_contato}
                  </span>
                )}
                <span className="text-xs font-mono font-medium text-white/50">
                  {formatCurrency(groupTotal)}
                </span>
              </div>
            </div>

            {/* Items table */}
            <div className="bg-white/5 rounded-b-md border border-t-0 border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="label-mono text-white/40 text-left px-4 py-2.5">
                      DESCRICAO
                    </th>
                    <th className="label-mono text-white/40 text-left px-4 py-2.5">
                      TIPO
                    </th>
                    <th className="label-mono text-white/40 text-right px-4 py-2.5">
                      QTD
                    </th>
                    <th className="label-mono text-white/40 text-right px-4 py-2.5">
                      UNIT
                    </th>
                    <th className="label-mono text-white/40 text-right px-4 py-2.5">
                      TOTAL
                    </th>
                    <th className="label-mono text-white/40 text-left px-4 py-2.5">
                      PRAZO
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <span className="text-sm text-white/70">
                          {item.descricao}
                        </span>
                        {item.codigo_referencia && (
                          <span className="ml-1.5 text-xs text-white/30 font-mono">
                            {item.codigo_referencia}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <TipoQualidadeBadge tipo={item.tipo_qualidade} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-mono text-white/60">
                          {item.quantidade}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-mono text-white/60">
                          {formatCurrency(item.valor_unitario)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-mono font-bold text-white">
                          {formatCurrency(item.valor_total)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-white/40">
                          {item.prazo_entrega || "--"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* ── OC Total ── */}
      <div className="section-divider">TOTAL DA ORDEM</div>
      <div className="bg-white/5 border border-white/10 rounded-lg p-6 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-2xl font-mono font-bold text-white">
            {formatCurrency(oc.valor_total)}
          </p>
          <p className="text-xs text-white/30">
            {oc.total_itens} {oc.total_itens === 1 ? "item" : "itens"} ·{" "}
            {supplierCount}{" "}
            {supplierCount === 1 ? "fornecedor" : "fornecedores"}
          </p>
        </div>

        {oc.observacoes && (
          <p className="text-sm text-white/40 max-w-sm text-right">
            {oc.observacoes}
          </p>
        )}
      </div>

      {/* ── Approval buttons ── */}
      {oc.status === "pendente_aprovacao" && canApprove && (
        <div className="space-y-3">
          <div className="section-divider">APROVACAO</div>

          {showRejectInput ? (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
              <label className="label-mono text-white/50">
                MOTIVO DA REJEICAO
              </label>
              <textarea
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Descreva o motivo da rejeicao..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRejeitar}
                  disabled={!motivoRejeicao.trim() || isRejecting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                             bg-error-500/15 text-error-400 border border-error-500/20
                             hover:bg-error-500/25 transition-colors
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={16} />
                  {isRejecting ? "Rejeitando..." : "Confirmar Rejeicao"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectInput(false)
                    setMotivoRejeicao("")
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowRejectInput(true)}
                disabled={isRejecting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                           bg-error-500/15 text-error-400 border border-error-500/20
                           hover:bg-error-500/25 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle size={16} />
                Rejeitar
              </button>

              <button
                type="button"
                onClick={onAprovar}
                disabled={isApproving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold
                           bg-success-400 text-black
                           hover:bg-success-500 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={16} />
                {isApproving ? "Aprovando..." : "Aprovar Compra"}
              </button>
            </div>
          )}

          <p className="text-xs text-white/20">
            Aprovacao requer permissao Financeiro/Admin (MANAGER+)
          </p>
        </div>
      )}
    </div>
  )
}
