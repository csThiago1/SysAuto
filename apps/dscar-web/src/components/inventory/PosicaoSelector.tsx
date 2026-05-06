"use client"

import { useState } from "react"
import {
  useArmazens,
  useRuas,
  usePrateleiras,
  useNiveis,
} from "@/hooks/useInventoryLocation"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PosicaoSelectorProps {
  value: string | null // nivel_id
  onChange: (nivelId: string | null) => void
  disabled?: boolean
}

/* ------------------------------------------------------------------ */
/*  Shared select styles                                               */
/* ------------------------------------------------------------------ */

const SELECT_CLS =
  "w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PosicaoSelector({
  value,
  onChange,
  disabled = false,
}: PosicaoSelectorProps) {
  const [armazemId, setArmazemId] = useState("")
  const [ruaId, setRuaId] = useState("")
  const [prateleiraId, setPrateleiraId] = useState("")

  // Queries
  const { data: armazens = [] } = useArmazens()
  const { data: ruas = [] } = useRuas(armazemId || undefined)
  const { data: prateleiras = [] } = usePrateleiras(ruaId || undefined)
  const { data: niveis = [] } = useNiveis(prateleiraId || undefined)

  function handleArmazemChange(newId: string) {
    setArmazemId(newId)
    setRuaId("")
    setPrateleiraId("")
    onChange(null)
  }

  function handleRuaChange(newId: string) {
    setRuaId(newId)
    setPrateleiraId("")
    onChange(null)
  }

  function handlePrateleiraChange(newId: string) {
    setPrateleiraId(newId)
    onChange(null)
  }

  function handleNivelChange(newId: string) {
    onChange(newId || null)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Armazém */}
      <div>
        <label className="label-mono text-muted-foreground mb-0.5 block">
          ARMAZÉM
        </label>
        <select
          value={armazemId}
          onChange={(e) => handleArmazemChange(e.target.value)}
          disabled={disabled}
          className={SELECT_CLS}
        >
          <option value="">Selecione...</option>
          {armazens.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigo} — {a.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Rua */}
      <div>
        <label className="label-mono text-muted-foreground mb-0.5 block">RUA</label>
        <select
          value={ruaId}
          onChange={(e) => handleRuaChange(e.target.value)}
          disabled={disabled || !armazemId}
          className={SELECT_CLS}
        >
          <option value="">
            {armazemId ? "Selecione..." : "Escolha o armazém"}
          </option>
          {ruas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.codigo}
              {r.descricao ? ` — ${r.descricao}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Prateleira */}
      <div>
        <label className="label-mono text-muted-foreground mb-0.5 block">
          PRATELEIRA
        </label>
        <select
          value={prateleiraId}
          onChange={(e) => handlePrateleiraChange(e.target.value)}
          disabled={disabled || !ruaId}
          className={SELECT_CLS}
        >
          <option value="">
            {ruaId ? "Selecione..." : "Escolha a rua"}
          </option>
          {prateleiras.map((p) => (
            <option key={p.id} value={p.id}>
              {p.codigo}
              {p.descricao ? ` — ${p.descricao}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Nível */}
      <div>
        <label className="label-mono text-muted-foreground mb-0.5 block">NÍVEL</label>
        <select
          value={value ?? ""}
          onChange={(e) => handleNivelChange(e.target.value)}
          disabled={disabled || !prateleiraId}
          className={SELECT_CLS}
        >
          <option value="">
            {prateleiraId ? "Selecione..." : "Escolha a prateleira"}
          </option>
          {niveis.map((n) => (
            <option key={n.id} value={n.id}>
              {n.codigo} — {n.endereco_completo}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
