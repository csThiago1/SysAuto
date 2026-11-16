"use client"

import { useState } from "react"
import {
  useArmazens,
  useRuas,
  usePrateleiras,
  useNiveis,
} from "@/hooks/useInventoryLocation"
import { NativeSelect } from "@/components/ui/native-select"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PosicaoSelectorProps {
  value: string | null // nivel_id
  onChange: (nivelId: string | null) => void
  disabled?: boolean
}

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
        <label className="label-mono text-muted-foreground mb-1.5 block">
          ARMAZÉM
        </label>
        <NativeSelect
          value={armazemId}
          onChange={(e) => handleArmazemChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Selecione...</option>
          {armazens.map((a) => (
            <option key={a.id} value={a.id}>
              {a.codigo} — {a.nome}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Rua */}
      <div>
        <label className="label-mono text-muted-foreground mb-1.5 block">RUA</label>
        <NativeSelect
          value={ruaId}
          onChange={(e) => handleRuaChange(e.target.value)}
          disabled={disabled || !armazemId}
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
        </NativeSelect>
      </div>

      {/* Prateleira */}
      <div>
        <label className="label-mono text-muted-foreground mb-1.5 block">
          PRATELEIRA
        </label>
        <NativeSelect
          value={prateleiraId}
          onChange={(e) => handlePrateleiraChange(e.target.value)}
          disabled={disabled || !ruaId}
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
        </NativeSelect>
      </div>

      {/* Nível */}
      <div>
        <label className="label-mono text-muted-foreground mb-1.5 block">NÍVEL</label>
        <NativeSelect
          value={value ?? ""}
          onChange={(e) => handleNivelChange(e.target.value)}
          disabled={disabled || !prateleiraId}
        >
          <option value="">
            {prateleiraId ? "Selecione..." : "Escolha a prateleira"}
          </option>
          {niveis.map((n) => (
            <option key={n.id} value={n.id}>
              {n.codigo} — {n.endereco_completo}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}
