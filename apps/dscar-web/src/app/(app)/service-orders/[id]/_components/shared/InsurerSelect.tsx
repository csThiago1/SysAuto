"use client"

import { useInsurers } from "../../_hooks/useInsurers"
import type { Insurer } from "@paddock/types"

interface InsurerSelectProps {
  value: string | null
  onChange: (insurerId: string | null, insurer: Insurer | null) => void
  disabled?: boolean
}

export function InsurerSelect({ value, onChange, disabled }: InsurerSelectProps) {
  const { data, isLoading } = useInsurers()
  const insurers = data?.results ?? []
  const selected = insurers.find((i) => i.id === value) ?? null

  return (
    <div className="flex items-center gap-3">
      {/* Avatar da seguradora */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
        style={{ backgroundColor: selected?.brand_color ?? "#e5e7eb" }}
      >
        {selected?.abbreviation || "?"}
      </div>

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
