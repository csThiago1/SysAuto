"use client"

import { useMemo, useState } from "react"
import { ArrowLeftRight, ChevronDown, ChevronRight } from "lucide-react"
import type { TipoMovimentacao, MovimentacaoEstoque } from "@paddock/types"
import { useMovimentacoes } from "@/hooks/useInventoryMovement"
import { ScrollFade } from "@/components/ui/scroll-fade"

// ─── Tipo badge config ──────────────────────────────────────────────────────

const TIPO_CONFIG: Record<
  TipoMovimentacao,
  { label: string; className: string; stripe: string }
> = {
  entrada_nf: {
    label: "Entrada NF",
    className: "bg-success-500/10 text-success-400",
    stripe: "bg-success-500",
  },
  entrada_manual: {
    label: "Entrada Manual",
    className: "bg-success-500/10 text-success-400",
    stripe: "bg-success-500",
  },
  entrada_devolucao: {
    label: "Devolucao",
    className: "bg-success-500/10 text-success-400",
    stripe: "bg-success-500",
  },
  saida_os: {
    label: "Saida OS",
    className: "bg-warning-500/10 text-warning-400",
    stripe: "bg-warning-500",
  },
  saida_perda: {
    label: "Perda",
    className: "bg-error-500/10 text-error-400",
    stripe: "bg-error-500",
  },
  transferencia: {
    label: "Transferencia",
    className: "bg-info-500/10 text-info-400",
    stripe: "bg-info-500",
  },
  ajuste_inventario: {
    label: "Ajuste",
    className: "bg-purple-500/10 text-purple-400",
    stripe: "bg-purple-500",
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
    "text-sm bg-muted/50 border border-border text-foreground rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Movimentações</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
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
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : movimentacoes.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhuma movimentacao encontrada.
        </div>
      ) : (
        <>
        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {movimentacoes.map((mov) => {
            const cfg = TIPO_CONFIG[mov.tipo] ?? {
              label: mov.tipo_display,
              className: "bg-muted text-foreground/60",
              stripe: "bg-muted-foreground/40",
            }
            const barcode = mov.unidade_barcode || mov.lote_barcode || "—"
            return (
              <div
                key={mov.id}
                className="relative overflow-hidden rounded-[11px] bg-muted/30 py-2.5 pl-4 pr-3"
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-[3px] ${cfg.stripe}`}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cfg.className}`}
                    >
                      {cfg.label}
                    </span>
                    <p className="mt-1 truncate font-mono text-xs text-foreground/70">
                      {barcode}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                    {mov.quantidade}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-[11px] text-muted-foreground">
                  <span className="truncate">
                    {mov.nivel_origem_endereco || "—"} → {mov.nivel_destino_endereco || "—"}
                  </span>
                  <span className="whitespace-nowrap text-right font-mono tabular-nums">
                    {formatDateShort(mov.created_at)}
                  </span>
                </div>
                {mov.realizado_por_nome && (
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    por {mov.realizado_por_nome}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block rounded-md border border-border bg-muted/50">
        <ScrollFade>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="label-mono text-muted-foreground text-left px-3 py-2 w-8" />
                <th className="label-mono text-muted-foreground text-left px-3 py-2">
                  DATA/HORA
                </th>
                <th className="label-mono text-muted-foreground text-left px-3 py-2">
                  TIPO
                </th>
                <th className="label-mono text-muted-foreground text-left px-3 py-2">
                  ITEM
                </th>
                <th className="label-mono text-muted-foreground text-left px-3 py-2">
                  ORIGEM
                </th>
                <th className="label-mono text-muted-foreground text-left px-3 py-2">
                  DESTINO
                </th>
                <th className="label-mono text-muted-foreground text-right px-3 py-2">
                  QTD
                </th>
                <th className="label-mono text-muted-foreground text-left px-3 py-2">
                  MOTIVO
                </th>
                <th className="label-mono text-muted-foreground text-left px-3 py-2">
                  REALIZADO POR
                </th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((mov) => {
                const cfg = TIPO_CONFIG[mov.tipo] ?? {
                  label: mov.tipo_display,
                  className: "bg-muted text-foreground/60",
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
        </ScrollFade>
        </div>
        </>
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
        className="border-b border-white/5 hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </td>
        <td className="px-3 py-2 text-foreground/70 whitespace-nowrap">
          {formatDateShort(mov.created_at)}
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${cfg.className}`}
          >
            {cfg.label}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-foreground/60">
          {barcode}
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs">
          {mov.nivel_origem_endereco || "—"}
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs">
          {mov.nivel_destino_endereco || "—"}
        </td>
        <td className="px-3 py-2 text-foreground text-right font-mono">
          {mov.quantidade}
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs max-w-[160px] truncate">
          {mov.motivo || "—"}
        </td>
        <td className="px-3 py-2 text-muted-foreground text-xs">
          {mov.realizado_por_nome || "—"}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-white/[0.02]">
          <td colSpan={9} className="px-6 py-3 space-y-2">
            {mov.motivo && (
              <div>
                <span className="label-mono text-muted-foreground">MOTIVO</span>
                <p className="text-sm text-foreground/70 mt-0.5">{mov.motivo}</p>
              </div>
            )}
            {mov.evidencia && (
              <div>
                <span className="label-mono text-muted-foreground">EVIDENCIA</span>
                <div className="mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mov.evidencia}
                    alt="Evidencia"
                    className="h-20 w-20 rounded-lg object-cover border border-border"
                  />
                </div>
              </div>
            )}
            {mov.aprovado_por_nome && (
              <div className="text-xs text-muted-foreground">
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
