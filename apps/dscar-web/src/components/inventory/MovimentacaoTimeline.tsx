"use client"

import type { MovimentacaoEstoque, TipoMovimentacao } from "@paddock/types"

// ─── Dot color by tipo ──────────────────────────────────────────────────────

const DOT_COLORS: Record<TipoMovimentacao, string> = {
  entrada_nf: "bg-success-400",
  entrada_manual: "bg-success-400",
  entrada_devolucao: "bg-success-400",
  transferencia: "bg-info-400",
  saida_os: "bg-warning-400",
  saida_perda: "bg-error-400",
  ajuste_inventario: "bg-purple-400",
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function itemLabel(mov: MovimentacaoEstoque): string {
  if (mov.unidade_barcode) return mov.unidade_barcode
  if (mov.lote_barcode) return mov.lote_barcode
  return "Item"
}

function actionDescription(mov: MovimentacaoEstoque): string {
  const parts: string[] = [mov.tipo_display]
  if (mov.nivel_origem_endereco && mov.nivel_destino_endereco) {
    parts.push(`${mov.nivel_origem_endereco} \u2192 ${mov.nivel_destino_endereco}`)
  } else if (mov.nivel_destino_endereco) {
    parts.push(`\u2192 ${mov.nivel_destino_endereco}`)
  } else if (mov.nivel_origem_endereco) {
    parts.push(`de ${mov.nivel_origem_endereco}`)
  }
  if (mov.quantidade && mov.quantidade !== "1") {
    parts.push(`(qtd: ${mov.quantidade})`)
  }
  return parts.join(" \u00b7 ")
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface MovimentacaoTimelineProps {
  movimentacoes: MovimentacaoEstoque[]
  loading?: boolean
}

export default function MovimentacaoTimeline({
  movimentacoes,
  loading,
}: MovimentacaoTimelineProps) {
  if (loading) {
    return (
      <div className="border-l-2 border-white/10 ml-2 pl-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="relative animate-pulse">
            <div className="absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="h-4 w-48 bg-white/5 rounded" />
            <div className="h-3 w-32 bg-white/5 rounded mt-2" />
          </div>
        ))}
      </div>
    )
  }

  if (movimentacoes.length === 0) {
    return (
      <div className="text-sm text-white/30 py-4">
        Nenhuma movimentacao registrada.
      </div>
    )
  }

  return (
    <div className="border-l-2 border-white/10 ml-2 pl-4 space-y-4">
      {movimentacoes.map((mov) => {
        const dotColor = DOT_COLORS[mov.tipo] ?? "bg-white/40"
        return (
          <div key={mov.id} className="relative">
            <div
              className={`absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full ${dotColor}`}
            />
            <div className="text-sm text-white">
              <span className="font-mono text-xs text-white/60">
                {itemLabel(mov)}
              </span>
              <span className="mx-1.5 text-white/20">&middot;</span>
              <span>{actionDescription(mov)}</span>
            </div>
            {mov.motivo && (
              <div className="text-xs text-white/40 mt-0.5 line-clamp-2">
                {mov.motivo}
              </div>
            )}
            <div className="text-xs text-white/30 mt-1">
              por {mov.realizado_por_nome || "Sistema"} &middot;{" "}
              {formatDate(mov.created_at)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
