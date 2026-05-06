"use client"

import { useState } from "react"
import { ClipboardList, Plus } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import type { StatusContagem, TipoContagem } from "@paddock/types"
import {
  useContagens,
  useContagemCreate,
} from "@/hooks/useInventoryCounting"
import { useArmazens, useRuas } from "@/hooks/useInventoryLocation"

// ─── Badge maps ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<StatusContagem, { label: string; className: string }> = {
  aberta: {
    label: "ABERTA",
    className: "bg-info-500/10 text-info-400 border border-info-500/20",
  },
  em_andamento: {
    label: "EM ANDAMENTO",
    className: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
  },
  finalizada: {
    label: "FINALIZADA",
    className: "bg-success-500/10 text-success-400 border border-success-500/20",
  },
  cancelada: {
    label: "CANCELADA",
    className: "bg-muted/50 text-muted-foreground border border-border",
  },
}

const TIPO_BADGE: Record<TipoContagem, { label: string; className: string }> = {
  ciclica: {
    label: "CÍCLICA",
    className: "bg-info-500/10 text-info-400 border border-info-500/20",
  },
  total: {
    label: "TOTAL",
    className: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
  },
}

export default function ContagensPage() {
  const { data: contagens = [], isLoading } = useContagens()
  const createMut = useContagemCreate()
  const { data: armazens = [] } = useArmazens()

  const [showForm, setShowForm] = useState(false)
  const [tipo, setTipo] = useState<TipoContagem>("ciclica")
  const [armazemId, setArmazemId] = useState("")
  const [ruaId, setRuaId] = useState("")

  // Ruas filtered by selected armazem
  const { data: ruas = [] } = useRuas(armazemId || undefined)

  function resetForm() {
    setTipo("ciclica")
    setArmazemId("")
    setRuaId("")
  }

  async function handleCreate() {
    if (tipo === "total" && !armazemId) {
      toast.error("Selecione o armazém para contagem total.")
      return
    }
    if (tipo === "ciclica" && !ruaId) {
      toast.error("Selecione a rua para contagem cíclica.")
      return
    }
    try {
      await createMut.mutateAsync({
        tipo,
        armazem_id: tipo === "total" ? armazemId : null,
        rua_id: tipo === "ciclica" ? ruaId : null,
      })
      toast.success("Contagem aberta com sucesso.")
      resetForm()
      setShowForm(false)
    } catch {
      toast.error("Erro ao abrir contagem.")
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Contagens de Inventário
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contagens.length} contage{contagens.length !== 1 ? "ns" : "m"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Contagem
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-4">
          {/* Tipo toggle */}
          <div>
            <label className="label-mono text-muted-foreground mb-1.5 block">TIPO</label>
            <div className="flex gap-2">
              {(["ciclica", "total"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTipo(t)
                    setArmazemId("")
                    setRuaId("")
                  }}
                  className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                    tipo === t
                      ? "border-primary text-primary/80 bg-primary/10"
                      : "border-border text-foreground/60 hover:text-foreground hover:border-border"
                  }`}
                >
                  {t === "ciclica" ? "Cíclica" : "Total"}
                </button>
              ))}
            </div>
          </div>

          {/* Scope selects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Armazem select — always shown */}
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                ARMAZÉM
              </label>
              <select
                value={armazemId}
                onChange={(e) => {
                  setArmazemId(e.target.value)
                  setRuaId("")
                }}
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecione...</option>
                {armazens.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} — {a.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Rua select — only for ciclica */}
            {tipo === "ciclica" && (
              <div>
                <label className="label-mono text-muted-foreground mb-0.5 block">
                  RUA
                </label>
                <select
                  value={ruaId}
                  onChange={(e) => setRuaId(e.target.value)}
                  disabled={!armazemId}
                  className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                >
                  <option value="">
                    {armazemId ? "Selecione a rua..." : "Escolha o armazém primeiro"}
                  </option>
                  {ruas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.codigo}
                      {r.descricao ? ` — ${r.descricao}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMut.isPending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {createMut.isPending ? "Abrindo..." : "Abrir Contagem"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : contagens.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhuma contagem registrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  DATA
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  TIPO
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  STATUS
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  ESCOPO
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  ITENS
                </th>
                <th className="label-mono text-muted-foreground px-4 py-2.5 text-left font-normal">
                  INICIADO POR
                </th>
              </tr>
            </thead>
            <tbody>
              {contagens.map((c) => {
                const statusBadge = STATUS_BADGE[c.status] ?? STATUS_BADGE.aberta
                const tipoBadge = TIPO_BADGE[c.tipo] ?? TIPO_BADGE.ciclica
                return (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/estoque/contagens/${c.id}` as Route}
                        className="text-foreground/80 hover:text-foreground transition-colors"
                      >
                        {formatDate(c.data_abertura)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${tipoBadge.className}`}
                      >
                        {tipoBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${statusBadge.className}`}
                      >
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/60 text-xs">
                      {c.tipo_display}
                      {c.observacoes ? ` — ${c.observacoes}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-foreground/80 font-mono">
                          {c.total_contados}/{c.total_itens}
                        </span>
                        {c.total_divergencias > 0 && (
                          <span className="text-error-400 font-mono">
                            ({c.total_divergencias} div.)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground/60 text-xs">
                      {c.iniciado_por_nome}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
