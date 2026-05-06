"use client"

import { useInsurers } from "../../_hooks/useInsurers"
import type { Insurer } from "@paddock/types"

interface InsurerSelectProps {
  value: string | null
  onChange: (insurerId: string | null, insurer: Insurer | null) => void
  disabled?: boolean
}

// Exported so InsurerSection can render the logo standalone
export function InsurerLogo({ insurer }: { insurer: Insurer | null }) {
  if (!insurer) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground text-2xl font-bold select-none">
        ?
      </div>
    )
  }
  if (insurer.logo) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 shadow-sm overflow-hidden">
        <img src={insurer.logo} alt={insurer.display_name} className="h-16 w-16 object-contain" />
      </div>
    )
  }
  return (
    <div
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl text-foreground text-xl font-bold shadow-sm select-none"
      style={{ backgroundColor: insurer.brand_color ?? "#6b7280" }}
    >
      {insurer.abbreviation || insurer.display_name?.charAt(0) || "?"}
    </div>
  )
}

// Legacy combined component (used in NewOSForm)
export function InsurerSelect({ value, onChange, disabled }: InsurerSelectProps) {
  const { data, isLoading } = useInsurers()
  const insurers = data?.results ?? []
  const selected = insurers.find((i) => i.id === value) ?? null

  return (
    <div className="flex items-center gap-3">
      <InsurerLogo insurer={selected} />
      <select
        className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
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
