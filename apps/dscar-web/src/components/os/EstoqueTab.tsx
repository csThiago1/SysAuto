"use client"

/**
 * Paddock Solutions — dscar-web
 * EstoqueTab: aba de estoque na OS detail
 * Mostra bipagem, tabela de margem (custo vs cobrado) e timeline de movimentacoes.
 * Visivel apenas para MANAGER+.
 */

import { useMemo } from "react"
import { Package } from "lucide-react"
import { formatCurrency } from "@paddock/utils"

import { PermissionGate } from "@/components/PermissionGate"
import { BarcodeScanInput } from "@/components/inventory/BarcodeScanInput"
import { MargemBadge } from "@/components/inventory/MargemBadge"
import MovimentacaoTimeline from "@/components/inventory/MovimentacaoTimeline"
import { useMovimentacoes } from "@/hooks/useInventoryMovement"

// ─── Types ──────────────────────────────────────────────────────────────────

interface EstoqueTabProps {
  osId: string
}

/** Row in the margin table — aggregated from movimentacoes + OS parts data */
interface MargemRow {
  id: string
  descricao: string
  sku: string
  posicao: string
  custo: number
  cobrado: number
}

// ─── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  variant = "neutral",
}: {
  label: string
  value: string
  variant?: "neutral" | "success" | "error"
}) {
  const borderClass =
    variant === "success"
      ? "border-success-500/20"
      : variant === "error"
      ? "border-error-500/20"
      : "border-white/10"

  const valueClass =
    variant === "success"
      ? "text-success-400"
      : variant === "error"
      ? "text-error-400"
      : "text-white"

  return (
    <div
      className={`rounded-md border bg-white/5 px-4 py-3 ${borderClass}`}
    >
      <p className="label-mono text-white/40">{label}</p>
      <p className={`mt-1 text-lg font-mono font-semibold ${valueClass}`}>
        {value}
      </p>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function EstoqueTab({ osId }: EstoqueTabProps) {
  const { data: movimentacoes = [], isLoading } = useMovimentacoes({
    ordem_servico: osId,
  })

  // Build margin rows from movimentacoes linked to this OS.
  // For now we use movimentacoes data as a placeholder structure.
  // When the dedicated cost endpoint is available, this will be replaced.
  const margemRows: MargemRow[] = useMemo(() => {
    return movimentacoes
      .filter((m) => m.tipo === "saida_os")
      .map((m) => ({
        id: m.id,
        descricao: m.unidade_barcode || m.lote_barcode || "Item",
        sku: m.unidade_barcode || m.lote_barcode || "-",
        posicao: m.nivel_destino_endereco || m.nivel_origem_endereco || "-",
        custo: 0, // TODO: resolve from UnidadeFisica.valor_nf / ConsumoInsumo.valor_unitario_na_baixa
        cobrado: 0, // TODO: resolve from ServiceOrderPart.sale_price / OSIntervencao.valor_peca
      }))
  }, [movimentacoes])

  const custoTotal = margemRows.reduce((sum, r) => sum + r.custo, 0)
  const cobradoTotal = margemRows.reduce((sum, r) => sum + r.cobrado, 0)
  const margemTotal =
    custoTotal > 0
      ? ((cobradoTotal - custoTotal) / custoTotal) * 100
      : 0
  const margemVariant =
    margemTotal > 0 ? "success" : margemTotal < 0 ? "error" : "neutral"

  function handleScan(code: string) {
    // TODO: link scanned barcode to this OS (bipar peca/insumo para a OS)
    // eslint-disable-next-line no-console
    console.info(`[EstoqueTab] Scanned: ${code} for OS ${osId}`)
  }

  return (
    <PermissionGate role="MANAGER">
      <div className="space-y-6">
        {/* A) Barcode scan input */}
        <div>
          <p className="label-mono text-white/40 mb-2">BIPAGEM RAPIDA</p>
          <BarcodeScanInput
            onScan={handleScan}
            placeholder="Bipe ou digite o codigo para vincular a esta OS..."
          />
        </div>

        {/* B) Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard
            label="CUSTO TOTAL"
            value={formatCurrency(custoTotal)}
          />
          <SummaryCard
            label="VALOR COBRADO"
            value={formatCurrency(cobradoTotal)}
          />
          <SummaryCard
            label="MARGEM TOTAL"
            value={`${margemTotal > 0 ? "+" : ""}${margemTotal.toFixed(1)}%`}
            variant={margemVariant}
          />
        </div>

        {/* C) Margin table */}
        <div>
          <p className="label-mono text-white/40 mb-2">
            PECAS E INSUMOS CONSUMIDOS
          </p>
          {margemRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-white/30">
              <Package className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">
                Nenhuma movimentacao de estoque vinculada a esta OS.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="label-mono text-white/40 px-3 py-2 text-left">
                      PECA / INSUMO
                    </th>
                    <th className="label-mono text-white/40 px-3 py-2 text-left">
                      SKU
                    </th>
                    <th className="label-mono text-white/40 px-3 py-2 text-left">
                      POSICAO
                    </th>
                    <th className="label-mono text-white/40 px-3 py-2 text-right">
                      CUSTO
                    </th>
                    <th className="label-mono text-white/40 px-3 py-2 text-right">
                      COBRADO
                    </th>
                    <th className="label-mono text-white/40 px-3 py-2 text-right">
                      MARGEM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {margemRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-3 py-2 text-white">{row.descricao}</td>
                      <td className="px-3 py-2 font-mono text-xs text-white/60">
                        {row.sku}
                      </td>
                      <td className="px-3 py-2 text-white/60">{row.posicao}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-white/60">
                        {formatCurrency(row.custo)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-white">
                        {formatCurrency(row.cobrado)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <MargemBadge custo={row.custo} cobrado={row.cobrado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* D) Movimentacao timeline */}
        <div>
          <p className="label-mono text-white/40 mb-2">
            HISTORICO DE MOVIMENTACOES
          </p>
          <MovimentacaoTimeline
            movimentacoes={movimentacoes}
            loading={isLoading}
          />
        </div>
      </div>
    </PermissionGate>
  )
}
