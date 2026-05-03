"use client"

import { useMemo, useState } from "react"
import { ArrowLeftRight, ChevronDown, ChevronRight } from "lucide-react"
import type { TipoMovimentacao, MovimentacaoEstoque } from "@paddock/types"
import { useMovimentacoes } from "@/hooks/useInventoryMovement"

// ─── Tipo badge config ──────────────────────────────────────────────────────

const TIPO_CONFIG: Record<
  TipoMovimentacao,
  { label: string; className: string }
> = {
  entrada_nf: {
    label: "Entrada NF",
    className: "bg-success-500/10 text-success-400",
  },
  entrada_manual: {
    label: "Entrada Manual",
    className: "bg-success-500/10 text-success-400",
  },
  entrada_devolucao: {
    label: "Devolucao",
    className: "bg-success-500/10 text-success-400",
  },
  saida_os: {
    label: "Saida OS",
    className: "bg-warning-500/10 text-warning-400",
  },
  saida_perda: {
    label: "Perda",
    className: "bg-error-500/10 text-error-400",
  },
  transferencia: {
    label: "Transferencia",
    className: "bg-info-500/10 text-info-400",
  },
  ajuste_inventario: {
    label: "Ajuste",
    className: "bg-purple-500/10 text-purple-400",
  },
}

const ALL_TIPOS: TipoMovimentacao[] = [
  "entrada_nf",
  "entrada_manual",
  "entrada_devolucao",
  "saida_os",
  "saida_perda",
  "transferencia",
  "ajuste_inventario",
]

function formatDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MovimentacoesPage() {
  const [tipoFilter, setTipoFilter] = useState("")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [osFilter, setOsFilter] = useState("")
  const [userFilter, setUserFilter] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Build query params
  const params = useMemo(() => {
    const p: Record<string, string> = {}
    if (tipoFilter) p.tipo = tipoFilter
    if (dataInicio) p.data_inicio = dataInicio
    if (dataFim) p.data_fim = dataFim
    if (osFilter) p.ordem_servico = osFilter
    if (userFilter) p.realizado_por = userFilter
    return p
  }, [tipoFilter, dataInicio, dataFim, osFilter, userFilter])

  const { data: movimentacoes = [], isLoading } = useMovimentacoes(
    Object.keys(params).length > 0 ? params : undefined
  )

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const inputClass =
    "text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-white/20"

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Movimentações</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {movimentacoes.length} registro{movimentacoes.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className={inputClass}
        >
          <option value="">Todos os tipos</option>
          {ALL_TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPO_CONFIG[t].label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className={inputClass}
          placeholder="Data inicio"
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className={inputClass}
          placeholder="Data fim"
        />
        <input
          type="text"
          value={osFilter}
          onChange={(e) => setOsFilter(e.target.value)}
          className={inputClass}
          placeholder="OS (UUID)"
        />
        <input
          type="text"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className={inputClass}
          placeholder="Usuario"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : movimentacoes.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma movimentacao encontrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="label-mono text-white/40 text-left px-3 py-2 w-8" />
                <th className="label-mono text-white/40 text-left px-3 py-2">
                  DATA/HORA
                </th>
                <th className="label-mono text-white/40 text-left px-3 py-2">
                  TIPO
                </th>
                <th className="label-mono text-white/40 text-left px-3 py-2">
                  ITEM
                </th>
                <th className="label-mono text-white/40 text-left px-3 py-2">
                  ORIGEM
                </th>
                <th className="label-mono text-white/40 text-left px-3 py-2">
                  DESTINO
                </th>
                <th className="label-mono text-white/40 text-right px-3 py-2">
                  QTD
                </th>
                <th className="label-mono text-white/40 text-left px-3 py-2">
                  MOTIVO
                </th>
                <th className="label-mono text-white/40 text-left px-3 py-2">
                  REALIZADO POR
                </th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((mov) => {
                const cfg = TIPO_CONFIG[mov.tipo] ?? {
                  label: mov.tipo_display,
                  className: "bg-white/10 text-white/60",
                }
                const isExpanded = expandedId === mov.id
                return (
                  <RowWithExpand
                    key={mov.id}
                    mov={mov}
                    cfg={cfg}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(mov.id)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Expandable Row ─────────────────────────────────────────────────────────

function RowWithExpand({
  mov,
  cfg,
  isExpanded,
  onToggle,
}: {
  mov: MovimentacaoEstoque
  cfg: { label: string; className: string }
  isExpanded: boolean
  onToggle: () => void
}) {
  const barcode = mov.unidade_barcode || mov.lote_barcode || "—"
  return (
    <>
      <tr
        className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-white/30">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </td>
        <td className="px-3 py-2 text-white/70 whitespace-nowrap">
          {formatDateShort(mov.created_at)}
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${cfg.className}`}
          >
            {cfg.label}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-white/60">
          {barcode}
        </td>
        <td className="px-3 py-2 text-white/50 text-xs">
          {mov.nivel_origem_endereco || "—"}
        </td>
        <td className="px-3 py-2 text-white/50 text-xs">
          {mov.nivel_destino_endereco || "—"}
        </td>
        <td className="px-3 py-2 text-white text-right font-mono">
          {mov.quantidade}
        </td>
        <td className="px-3 py-2 text-white/50 text-xs max-w-[160px] truncate">
          {mov.motivo || "—"}
        </td>
        <td className="px-3 py-2 text-white/50 text-xs">
          {mov.realizado_por_nome || "—"}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-white/[0.02]">
          <td colSpan={9} className="px-6 py-3 space-y-2">
            {mov.motivo && (
              <div>
                <span className="label-mono text-white/40">MOTIVO</span>
                <p className="text-sm text-white/70 mt-0.5">{mov.motivo}</p>
              </div>
            )}
            {mov.evidencia && (
              <div>
                <span className="label-mono text-white/40">EVIDENCIA</span>
                <div className="mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mov.evidencia}
                    alt="Evidencia"
                    className="h-20 w-20 rounded-lg object-cover border border-white/10"
                  />
                </div>
              </div>
            )}
            {mov.aprovado_por_nome && (
              <div className="text-xs text-white/30">
                Aprovado por {mov.aprovado_por_nome}
                {mov.aprovado_em
                  ? ` em ${formatDateShort(mov.aprovado_em)}`
                  : ""}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
