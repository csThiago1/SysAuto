"use client"

import { useInsurers } from "../../_hooks/useInsurers"
import type { Insurer } from "@paddock/types"

interface InsurerSelectProps {
  value: string | null
  onChange: (insurerId: string | null, insurer: Insurer | null) => void
  disabled?: boolean
}

function InsurerAvatar({ insurer }: { insurer: Insurer | null }) {
  if (!insurer) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-400 text-xs font-bold">
        ?
      </div>
    )
  }
  if (insurer.logo) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white overflow-hidden">
        <img src={insurer.logo} alt={insurer.display_name} className="h-7 w-7 object-contain" />
      </div>
    )
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
      style={{ backgroundColor: insurer.brand_color ?? "#6b7280" }}
    >
      {insurer.abbreviation || insurer.display_name?.charAt(0) || "?"}
    </div>
  )
}

export function InsurerSelect({ value, onChange, disabled }: InsurerSelectProps) {
  const { data, isLoading } = useInsurers()
  const insurers = data?.results ?? []
  const selected = insurers.find((i) => i.id === value) ?? null

  return (
    <div className="flex items-center gap-3">
      <InsurerAvatar insurer={selected} />
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        value={value ?? ""}
        disabled={disabled || isLoading}
        onChange={(e) => {
          const id = e.target.value || null
          const ins = insurers.find((i) => i.id === id) ?? null
          onChange(id, ins)
        }}
      >
        <option value="">Selecione a seguradora...</option>
        {insurers.map((ins) => (
          <option key={ins.id} value={ins.id}>
            {ins.display_name}
          </option>
        ))}
      </select>
    </div>
  )
}
