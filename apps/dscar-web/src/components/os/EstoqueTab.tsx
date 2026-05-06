"use client"

/**
 * Paddock Solutions — dscar-web
 * EstoqueTab: aba de estoque na OS detail
 * Mostra bipagem, tabela de margem (custo vs cobrado) e timeline de movimentacoes.
 * Visivel apenas para MANAGER+.
 */

import { Package } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { formatCurrency } from "@paddock/utils"

import { apiFetch } from "@/lib/api"
import { PermissionGate } from "@/components/PermissionGate"
import { BarcodeScanInput } from "@/components/inventory/BarcodeScanInput"
import { MargemBadge } from "@/components/inventory/MargemBadge"
import MovimentacaoTimeline from "@/components/inventory/MovimentacaoTimeline"
import { useMovimentacoes } from "@/hooks/useInventoryMovement"

// ─── Types ──────────────────────────────────────────────────────────────────

interface EstoqueTabProps {
  osId: string
}

interface MargemItem {
  tipo: "peca" | "insumo"
  nome: string
  sku: string
  codigo_barras: string
  posicao: string
  custo: string
  cobrado: string
  margem_pct: string
}

interface MargemOSResponse {
  itens: MargemItem[]
  resumo: {
    custo_total: string
    cobrado_total: string
    margem_total: string
    margem_total_pct: string
  }
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
      : "border-border"

  const valueClass =
    variant === "success"
      ? "text-success-400"
      : variant === "error"
      ? "text-error-400"
      : "text-foreground"

  return (
    <div
      className={`rounded-md border bg-muted/50 px-4 py-3 ${borderClass}`}
    >
      <p className="label-mono text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-mono font-semibold ${valueClass}`}>
        {value}
      </p>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function EstoqueTab({ osId }: EstoqueTabProps) {
  // Margin data from dedicated endpoint
  const { data: margem, isLoading: margemLoading } = useQuery({
    queryKey: ["inventory", "margem-os", osId],
    queryFn: () =>
      apiFetch<MargemOSResponse>(`/api/proxy/inventory/margem-os/${osId}/`),
    enabled: !!osId,
  })

  // Movimentacoes for the timeline (kept separate)
  const { data: movimentacoes = [], isLoading: movLoading } = useMovimentacoes({
    ordem_servico: osId,
  })

  const resumo = margem?.resumo
  const margemPct = resumo ? parseFloat(resumo.margem_total_pct) : 0
  const margemVariant =
    margemPct > 0 ? "success" : margemPct < 0 ? "error" : "neutral"

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
          <p className="label-mono text-muted-foreground mb-2">BIPAGEM RAPIDA</p>
          <BarcodeScanInput
            onScan={handleScan}
            placeholder="Bipe ou digite o codigo para vincular a esta OS..."
          />
        </div>

        {/* B) Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard
            label="CUSTO TOTAL"
            value={
              resumo
                ? formatCurrency(parseFloat(resumo.custo_total))
                : formatCurrency(0)
            }
          />
          <SummaryCard
            label="VALOR COBRADO"
            value={
              resumo
                ? formatCurrency(parseFloat(resumo.cobrado_total))
                : formatCurrency(0)
            }
          />
          <SummaryCard
            label="MARGEM TOTAL"
            value={
              resumo
                ? `${margemPct > 0 ? "+" : ""}${margemPct.toFixed(1)}%`
                : "0.0%"
            }
            variant={margemVariant}
          />
        </div>

        {/* C) Margin table */}
        <div>
          <p className="label-mono text-muted-foreground mb-2">
            PECAS E INSUMOS CONSUMIDOS
          </p>
          {margemLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm">Carregando...</p>
            </div>
          ) : !margem?.itens.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">
                Nenhuma movimentacao de estoque vinculada a esta OS.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border bg-muted/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="label-mono text-muted-foreground px-3 py-2 text-left">
                      PECA / INSUMO
                    </th>
                    <th className="label-mono text-muted-foreground px-3 py-2 text-left">
                      SKU
                    </th>
                    <th className="label-mono text-muted-foreground px-3 py-2 text-left">
                      POSICAO
                    </th>
                    <th className="label-mono text-muted-foreground px-3 py-2 text-right">
                      CUSTO
                    </th>
                    <th className="label-mono text-muted-foreground px-3 py-2 text-right">
                      COBRADO
                    </th>
                    <th className="label-mono text-muted-foreground px-3 py-2 text-right">
                      MARGEM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {margem.itens.map((item, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2 text-foreground text-sm">
                        {item.nome}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {item.sku || "\u2014"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-primary/80">
                        {item.posicao || "\u2014"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-foreground/80">
                        R$ {parseFloat(item.custo).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-foreground/80">
                        R$ {parseFloat(item.cobrado).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <MargemBadge
                          custo={parseFloat(item.custo)}
                          cobrado={parseFloat(item.cobrado)}
                        />
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
          <p className="label-mono text-muted-foreground mb-2">
            HISTORICO DE MOVIMENTACOES
          </p>
          <MovimentacaoTimeline
            movimentacoes={movimentacoes}
            loading={movLoading}
          />
        </div>
      </div>
    </PermissionGate>
  )
}
