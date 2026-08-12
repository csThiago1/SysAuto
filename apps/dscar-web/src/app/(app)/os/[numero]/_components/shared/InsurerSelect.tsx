"use client"

import { useInsurers } from "../../_hooks/useInsurers"
import type { Insurer } from "@paddock/types"
import { NativeSelect } from "@/components/ui/native-select"

interface InsurerSelectProps {
  value: string | null
  onChange: (insurerId: string | null, insurer: Insurer | null) => void
  disabled?: boolean
  /** Seguradora já resolvida (ex: insurer_detail da OS) — fallback quando
   * `value` não está entre os resultados carregados. */
  knownInsurer?: Insurer | null
}

// Exported so InsurerSection can render the logo standalone.
// `compact` = adorno de 36px ao lado do select (altura de campo);
// sem ele, o bloco grande de 80px usado nas telas legadas.
export function InsurerLogo({
  insurer,
  compact = false,
}: {
  insurer: Insurer | null
  compact?: boolean
}) {
  const box = compact
    ? "h-9 w-9 shrink-0 rounded-md"
    : "h-20 w-20 shrink-0 rounded-xl"

  if (!insurer) {
    if (compact) return null // sem seguradora nao ha o que adornar
    return (
      <div className={`flex ${box} items-center justify-center border-2 border-dashed border-border bg-muted/30 text-muted-foreground text-2xl font-bold select-none`}>
        ?
      </div>
    )
  }
  if (insurer.logo) {
    return (
      <div className={`flex ${box} items-center justify-center overflow-hidden bg-muted/50`}>
        <img
          src={insurer.logo}
          alt={insurer.display_name}
          className={compact ? "h-7 w-7 object-contain" : "h-16 w-16 object-contain"}
        />
      </div>
    )
  }
  return (
    <div
      className={`flex ${box} items-center justify-center font-bold text-foreground select-none ${compact ? "text-xs" : "text-xl shadow-sm"}`}
      style={{ backgroundColor: insurer.brand_color ?? "#6b7280" }}
    >
      {insurer.abbreviation || insurer.display_name?.charAt(0) || "?"}
    </div>
  )
}

// Legacy combined component (used in NewOSForm)
export function InsurerSelect({ value, onChange, disabled, knownInsurer }: InsurerSelectProps) {
  const { data, isLoading } = useInsurers()
  const insurers = data?.results ?? []
  const selected =
    insurers.find((i) => i.id === value) ?? (knownInsurer?.id === value ? knownInsurer : null)

  return (
    <div className="flex items-center gap-3">
      <InsurerLogo insurer={selected} />
      <NativeSelect
        className="w-full font-medium"
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
      </NativeSelect>
    </div>
  )
}
