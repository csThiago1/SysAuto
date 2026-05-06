"use client"

import { useState, useCallback } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { Rua, Prateleira, Nivel } from "@paddock/types"
import {
  useRuas,
  usePrateleiras,
  useNiveis,
} from "@/hooks/useInventoryLocation"

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ArmazemTreeProps {
  armazemId: string
}

/* ------------------------------------------------------------------ */
/*  Root                                                               */
/* ------------------------------------------------------------------ */

export function ArmazemTree({ armazemId }: ArmazemTreeProps) {
  const { data: ruas = [], isLoading } = useRuas(armazemId)
  const [expandedRuas, setExpandedRuas] = useState<Set<string>>(new Set())
  const [expandedPrateleiras, setExpandedPrateleiras] = useState<Set<string>>(
    new Set()
  )

  const toggleRua = useCallback((id: string) => {
    setExpandedRuas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const togglePrateleira = useCallback((id: string) => {
    setExpandedPrateleiras((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Carregando hierarquia...</div>
  }

  if (ruas.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-6 text-center text-muted-foreground text-sm">
        Nenhuma rua cadastrada neste armazém.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {ruas.map((rua) => (
        <RuaNode
          key={rua.id}
          rua={rua}
          expanded={expandedRuas.has(rua.id)}
          onToggle={toggleRua}
          expandedPrateleiras={expandedPrateleiras}
          onTogglePrateleira={togglePrateleira}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Rua                                                                */
/* ------------------------------------------------------------------ */

function RuaNode({
  rua,
  expanded,
  onToggle,
  expandedPrateleiras,
  onTogglePrateleira,
}: {
  rua: Rua
  expanded: boolean
  onToggle: (id: string) => void
  expandedPrateleiras: Set<string>
  onTogglePrateleira: (id: string) => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(rua.id)}
        className="w-full flex items-center gap-2 bg-muted/30 hover:bg-muted/50 px-4 py-3 rounded-md cursor-pointer transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-mono text-sm font-semibold text-foreground">
          {rua.codigo}
        </span>
        {rua.descricao && (
          <span className="text-sm text-foreground/60">— {rua.descricao}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {rua.total_prateleiras} prateleira
          {rua.total_prateleiras !== 1 ? "s" : ""}
        </span>
      </button>

      {expanded && (
        <PrateleiraList
          ruaId={rua.id}
          expandedPrateleiras={expandedPrateleiras}
          onTogglePrateleira={onTogglePrateleira}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Prateleira list (lazy-loaded per rua)                             */
/* ------------------------------------------------------------------ */

function PrateleiraList({
  ruaId,
  expandedPrateleiras,
  onTogglePrateleira,
}: {
  ruaId: string
  expandedPrateleiras: Set<string>
  onTogglePrateleira: (id: string) => void
}) {
  const { data: prateleiras = [], isLoading } = usePrateleiras(ruaId)

  if (isLoading) {
    return (
      <div className="pl-10 px-4 py-2 text-xs text-muted-foreground">
        Carregando prateleiras...
      </div>
    )
  }

  if (prateleiras.length === 0) {
    return (
      <div className="pl-10 px-4 py-2 text-xs text-muted-foreground">
        Nenhuma prateleira nesta rua.
      </div>
    )
  }

  return (
    <div className="space-y-0.5 mt-0.5">
      {prateleiras.map((p) => (
        <PrateleiraNode
          key={p.id}
          prateleira={p}
          expanded={expandedPrateleiras.has(p.id)}
          onToggle={onTogglePrateleira}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Prateleira                                                         */
/* ------------------------------------------------------------------ */

function PrateleiraNode({
  prateleira,
  expanded,
  onToggle,
}: {
  prateleira: Prateleira
  expanded: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(prateleira.id)}
        className="w-full flex items-center gap-2 pl-10 px-4 py-2.5 hover:bg-muted/30 rounded-sm cursor-pointer transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="font-mono text-sm text-foreground/80">
          {prateleira.codigo}
        </span>
        {prateleira.descricao && (
          <span className="text-xs text-muted-foreground">
            — {prateleira.descricao}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {prateleira.capacidade_kg && (
            <span className="text-xs text-muted-foreground">
              Cap: {prateleira.capacidade_kg}kg
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {prateleira.total_niveis} nível
            {prateleira.total_niveis !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {expanded && <NivelList prateleiraId={prateleira.id} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Nivel list (lazy-loaded per prateleira)                           */
/* ------------------------------------------------------------------ */

function NivelList({ prateleiraId }: { prateleiraId: string }) {
  const { data: niveis = [], isLoading } = useNiveis(prateleiraId)

  if (isLoading) {
    return (
      <div className="pl-20 px-4 py-2 text-xs text-muted-foreground">
        Carregando níveis...
      </div>
    )
  }

  if (niveis.length === 0) {
    return (
      <div className="pl-20 px-4 py-2 text-xs text-muted-foreground">
        Nenhum nível nesta prateleira.
      </div>
    )
  }

  return (
    <div className="space-y-0.5 mt-0.5">
      {niveis.map((n) => (
        <NivelRow key={n.id} nivel={n} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Nivel row                                                          */
/* ------------------------------------------------------------------ */

function NivelRow({ nivel }: { nivel: Nivel }) {
  const totalItens = nivel.total_unidades + nivel.total_lotes
  const isOcupado = totalItens > 0

  return (
    <div className="flex items-center gap-3 pl-20 px-4 py-2 hover:bg-white/[0.02] rounded-sm transition-colors">
      {/* Endereco completo badge */}
      <span className="font-mono text-xs text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded whitespace-nowrap">
        {nivel.endereco_completo}
      </span>

      {/* Item count */}
      <span className="text-xs text-muted-foreground">
        {nivel.total_unidades > 0 &&
          `${nivel.total_unidades} peça${nivel.total_unidades !== 1 ? "s" : ""}`}
        {nivel.total_unidades > 0 && nivel.total_lotes > 0 && " + "}
        {nivel.total_lotes > 0 &&
          `${nivel.total_lotes} lote${nivel.total_lotes !== 1 ? "s" : ""}`}
        {totalItens === 0 && "vazio"}
      </span>

      {/* Status dot */}
      <span className="ml-auto flex items-center gap-1.5">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            isOcupado ? "bg-success-400" : "bg-white/20"
          }`}
        />
        <span
          className={`text-[10px] font-mono uppercase tracking-wider ${
            isOcupado ? "text-success-400" : "text-muted-foreground"
          }`}
        >
          {isOcupado ? "OCUPADO" : "VAZIO"}
        </span>
      </span>
    </div>
  )
}
