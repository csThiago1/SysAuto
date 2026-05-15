"use client"

import { useState } from "react"
import type {
  OrdemCompraDetail as OrdemCompraDetailType,
  ItemOrdemCompra,
  StatusOrdemCompra,
  StatusEntrega,
  DestinoEntrega,
} from "@paddock/types"
import { formatCurrency } from "@paddock/utils"
import { usePermission } from "@/hooks/usePermission"
import { useNiveis, useReceberItem } from "@/hooks/usePurchasing"
import { TipoQualidadeBadge } from "@/components/purchasing/TipoQualidadeBadge"
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Package,
  Truck,
  AlertTriangle,
  PackageCheck,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// ─── OC Status config ─────────────────────────────────────────────────────────

const OC_STATUS_CONFIG: Record<
  StatusOrdemCompra,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  rascunho: {
    label: "Rascunho",
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    border: "border-border",
    dot: "bg-muted/500",
  },
  pendente_aprovacao: {
    label: "Pendente Aprovação",
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
    label: "Parcialmente Recebida",
    bg: "bg-info-500/10",
    text: "text-info-400",
    border: "border-info-500/20",
    dot: "bg-info-400",
  },
  concluida: {
    label: "Concluída",
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

// ─── Entrega Status badge ──────────────────────────────────────────────────────

const ENTREGA_STATUS_CONFIG: Record<
  StatusEntrega,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  aguardando: {
    label: "Aguardando",
    bg: "bg-warning-500/10",
    text: "text-warning-400",
    border: "border-warning-500/20",
    icon: <Clock size={11} />,
  },
  em_transito: {
    label: "Em Trânsito",
    bg: "bg-info-500/10",
    text: "text-info-400",
    border: "border-info-500/20",
    icon: <Truck size={11} />,
  },
  recebido: {
    label: "Recebido",
    bg: "bg-success-500/10",
    text: "text-success-400",
    border: "border-success-500/20",
    icon: <CheckCircle size={11} />,
  },
  atrasado: {
    label: "Atrasado",
    bg: "bg-error-500/10",
    text: "text-error-400",
    border: "border-error-500/20",
    icon: <AlertTriangle size={11} />,
  },
}

function EntregaStatusBadge({ status }: { status: StatusEntrega }) {
  const cfg = ENTREGA_STATUS_CONFIG[status] ?? ENTREGA_STATUS_CONFIG.aguardando
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ─── Receber Dialog ───────────────────────────────────────────────────────────

interface ReceberDialogProps {
  ocId: string
  item: ItemOrdemCompra
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ReceberDialog({ ocId, item, open, onOpenChange }: ReceberDialogProps) {
  const [destino, setDestino] = useState<DestinoEntrega>("estoque_geral")
  const [selectedNivel, setSelectedNivel] = useState("")
  const [valorNF, setValorNF] = useState(item.valor_unitario ?? "")
  const [numeroSerie, setNumeroSerie] = useState("")
  const receberItem = useReceberItem()
  const { data: niveis = [], isLoading: loadingNiveis } = useNiveis()

  const canSubmit = selectedNivel.length > 0 && valorNF.toString().length > 0 && !receberItem.isPending

  async function handleConfirmar() {
    if (!selectedNivel) {
      toast.error("Selecione a localização no armazém.")
      return
    }
    if (!valorNF) {
      toast.error("Informe o valor da nota fiscal.")
      return
    }
    try {
      const result = await receberItem.mutateAsync({
        ocId,
        itemId: item.id,
        nivel_id: selectedNivel,
        valor_nf: String(valorNF),
        destino,
        numero_serie: numeroSerie || undefined,
      })
      toast.success(`Recebido! Código: ${result.codigo_barras}`)
      onOpenChange(false)
    } catch {
      toast.error("Erro ao registrar recebimento. Tente novamente.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Recebimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Item summary */}
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-sm text-foreground/80 font-medium">{item.descricao}</p>
            {item.codigo_referencia && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Ref: {item.codigo_referencia}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Fornecedor: {item.fornecedor_nome} · Qtd: {item.quantidade} · {formatCurrency(item.valor_total)}
            </p>
          </div>

          {/* Localização no armazém */}
          <div className="space-y-2">
            <Label className="label-mono text-muted-foreground">LOCALIZAÇÃO NO ARMAZÉM *</Label>
            <select
              value={selectedNivel}
              onChange={(e) => setSelectedNivel(e.target.value)}
              disabled={loadingNiveis}
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 focus:outline-none focus:border-border disabled:opacity-50"
            >
              <option value="">
                {loadingNiveis ? "Carregando localizações..." : "Selecione a localização..."}
              </option>
              {niveis.map((nivel) => (
                <option key={nivel.id} value={nivel.id}>
                  {nivel.endereco_completo}
                </option>
              ))}
            </select>
          </div>

          {/* Valor NF */}
          <div className="space-y-2">
            <Label className="label-mono text-muted-foreground">VALOR NF — CUSTO REAL *</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={valorNF}
              onChange={(e) => setValorNF(e.target.value)}
              placeholder="0,00"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Pré-preenchido com o valor unitário da OC. Ajuste conforme a NF recebida.
            </p>
          </div>

          {/* Número de série (opcional) */}
          <div className="space-y-2">
            <Label className="label-mono text-muted-foreground">NÚMERO DE SÉRIE (opcional)</Label>
            <Input
              type="text"
              value={numeroSerie}
              onChange={(e) => setNumeroSerie(e.target.value)}
              placeholder="Ex: SN-123456"
              className="font-mono"
            />
          </div>

          {/* Destino */}
          <div className="space-y-2">
            <Label className="label-mono text-muted-foreground">DESTINO DO MATERIAL</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <input
                  type="radio"
                  name="destino"
                  value="estoque_geral"
                  checked={destino === "estoque_geral"}
                  onChange={() => setDestino("estoque_geral")}
                  className="accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground/80">Estoque Geral</p>
                  <p className="text-xs text-muted-foreground">
                    Peça vai para o estoque físico do almoxarifado
                  </p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <input
                  type="radio"
                  name="destino"
                  value="os_direta"
                  checked={destino === "os_direta"}
                  onChange={() => setDestino("os_direta")}
                  className="accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-foreground/80">Direto para OS</p>
                  <p className="text-xs text-muted-foreground">
                    Peça vai direto para a ordem de serviço sem passar pelo estoque
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={receberItem.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canSubmit}
              onClick={() => void handleConfirmar()}
              className="bg-success-500/15 text-success-400 border border-success-500/20 hover:bg-success-500/25"
            >
              <PackageCheck size={14} />
              {receberItem.isPending ? "Registrando..." : "Confirmar Recebimento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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

function formatDataPrevista(dataPrevista: string | null): { text: string; vencida: boolean } {
  if (!dataPrevista) return { text: "--", vencida: false }
  const date = new Date(dataPrevista + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const vencida = date < today
  return {
    text: date.toLocaleDateString("pt-BR"),
    vencida,
  }
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
  const [receberItem, setReceberItem] = useState<ItemOrdemCompra | null>(null)

  const fornecedorGroups = groupByFornecedor(oc.itens)
  const supplierCount = uniqueSupplierCount(oc.itens)

  const showReceiving = ["aprovada", "parcial_recebida", "concluida"].includes(oc.status)

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
            <h2 className="text-lg font-semibold text-foreground font-mono">
              {oc.numero}
            </h2>
            <OCStatusBadge status={oc.status} />
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {oc.os_number && (
              <span className="flex items-center gap-1">
                <FileText size={14} className="text-primary" />
                <span className="font-mono text-primary">
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

      {/* ── Receiving section (when approved or partially received) ── */}
      {showReceiving && (
        <div className="space-y-0">
          <div className="section-divider">ITENS DA ORDEM DE COMPRA — RECEBIMENTO</div>
          <div className="bg-muted/50 rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                    PEÇA
                  </th>
                  <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                    FORNECEDOR
                  </th>
                  <th className="label-mono text-muted-foreground text-right px-4 py-2.5">
                    QTD
                  </th>
                  <th className="label-mono text-muted-foreground text-right px-4 py-2.5">
                    TOTAL
                  </th>
                  <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                    PREVISÃO
                  </th>
                  <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                    STATUS
                  </th>
                  <th className="label-mono text-muted-foreground text-center px-4 py-2.5">
                    AÇÃO
                  </th>
                </tr>
              </thead>
              <tbody>
                {oc.itens.map((item) => {
                  const previsao = formatDataPrevista(item.data_prevista)
                  const podeReceber = item.status_entrega !== "recebido"
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground/80">{item.descricao}</p>
                        {item.codigo_referencia && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {item.codigo_referencia}
                          </p>
                        )}
                        {item.data_recebimento && (
                          <p className="text-xs text-success-400 mt-0.5">
                            Recebido em {new Date(item.data_recebimento + "T00:00:00").toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground">
                          {item.fornecedor_nome || "--"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono text-foreground/60">
                          {item.quantidade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono font-bold text-foreground">
                          {formatCurrency(item.valor_total)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-mono ${
                            previsao.vencida && item.status_entrega !== "recebido"
                              ? "text-error-400 font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {previsao.vencida && item.status_entrega !== "recebido" && (
                            <AlertTriangle size={10} className="inline mr-1 mb-0.5" />
                          )}
                          {previsao.text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <EntregaStatusBadge status={item.status_entrega} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {podeReceber ? (
                          <button
                            type="button"
                            onClick={() => setReceberItem(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                                       bg-success-500/10 text-success-400 border border-success-500/20
                                       hover:bg-success-500/20 transition-colors"
                          >
                            <Package size={12} />
                            Receber
                          </button>
                        ) : (
                          <span className="text-xs text-success-400 flex items-center justify-center gap-1">
                            <CheckCircle size={12} />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Items grouped by fornecedor (non-receiving view) ── */}
      {!showReceiving && Object.entries(fornecedorGroups).map(([fornecedorNome, items], idx) => {
        const firstItem = items[0]
        const groupTotal = items.reduce(
          (sum, i) => sum + parseFloat(i.valor_total || "0"),
          0
        )

        return (
          <div key={fornecedorNome} className="space-y-0">
            <div className="section-divider">{`FORNECEDOR ${idx + 1}`}</div>

            <div className="bg-muted/30 border border-border rounded-t-lg px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Truck size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground/70">
                  {fornecedorNome}
                </span>
                {firstItem?.fornecedor_cnpj && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {firstItem.fornecedor_cnpj}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {firstItem?.fornecedor_contato && (
                  <span className="text-xs text-muted-foreground">
                    {firstItem.fornecedor_contato}
                  </span>
                )}
                <span className="text-xs font-mono font-medium text-muted-foreground">
                  {formatCurrency(groupTotal)}
                </span>
              </div>
            </div>

            <div className="bg-muted/50 rounded-b-md border border-t-0 border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                      DESCRICAO
                    </th>
                    <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                      TIPO
                    </th>
                    <th className="label-mono text-muted-foreground text-right px-4 py-2.5">
                      QTD
                    </th>
                    <th className="label-mono text-muted-foreground text-right px-4 py-2.5">
                      UNIT
                    </th>
                    <th className="label-mono text-muted-foreground text-right px-4 py-2.5">
                      TOTAL
                    </th>
                    <th className="label-mono text-muted-foreground text-left px-4 py-2.5">
                      PRAZO
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border hover:bg-muted transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <span className="text-sm text-foreground/70">
                          {item.descricao}
                        </span>
                        {item.codigo_referencia && (
                          <span className="ml-1.5 text-xs text-muted-foreground font-mono">
                            {item.codigo_referencia}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <TipoQualidadeBadge tipo={item.tipo_qualidade} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-mono text-foreground/60">
                          {item.quantidade}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-mono text-foreground/60">
                          {formatCurrency(item.valor_unitario)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-mono font-bold text-foreground">
                          {formatCurrency(item.valor_total)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-muted-foreground">
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
      <div className="bg-muted/50 border border-border rounded-lg p-6 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-2xl font-mono font-bold text-foreground">
            {formatCurrency(oc.valor_total)}
          </p>
          <p className="text-xs text-muted-foreground">
            {oc.total_itens} {oc.total_itens === 1 ? "item" : "itens"} ·{" "}
            {supplierCount}{" "}
            {supplierCount === 1 ? "fornecedor" : "fornecedores"}
          </p>
        </div>

        {oc.observacoes && (
          <p className="text-sm text-muted-foreground max-w-sm text-right">
            {oc.observacoes}
          </p>
        )}
      </div>

      {/* ── Approval buttons ── */}
      {oc.status === "pendente_aprovacao" && canApprove && (
        <div className="space-y-3">
          <div className="section-divider">APROVAÇÃO</div>

          {showRejectInput ? (
            <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
              <label className="label-mono text-muted-foreground">
                MOTIVO DA REJEIÇÃO
              </label>
              <textarea
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                placeholder="Descreva o motivo da rejeição..."
                rows={3}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:border-border resize-none"
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
                  {isRejecting ? "Rejeitando..." : "Confirmar Rejeição"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectInput(false)
                    setMotivoRejeicao("")
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground/60 transition-colors"
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

          <p className="text-xs text-muted-foreground/50">
            Aprovação requer permissão Financeiro/Admin (MANAGER+)
          </p>
        </div>
      )}

      {/* ── Receber Dialog ── */}
      {receberItem && (
        <ReceberDialog
          ocId={oc.id}
          item={receberItem}
          open={!!receberItem}
          onOpenChange={(open) => {
            if (!open) setReceberItem(null)
          }}
        />
      )}
    </div>
  )
}
