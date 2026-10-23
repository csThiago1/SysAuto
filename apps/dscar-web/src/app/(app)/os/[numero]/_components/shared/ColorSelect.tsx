"use client"

import { useVehicleColors } from "../../_hooks/useVehicleCatalog"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"

interface ColorSelectProps {
  /** Código do enum CorVeiculo (ex: "PRETA"). */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ColorSelect({ value, onChange, disabled }: ColorSelectProps) {
  const { data: colors, isLoading, isError } = useVehicleColors()

  if (isLoading) return <Skeleton className="h-9 w-full" />
  if (isError || !colors) {
    return <p className="text-sm text-destructive">Erro ao carregar as cores.</p>
  }

  const selected = colors.find((c) => c.value === value) ?? null

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-6 w-6 shrink-0 rounded-full border border-border shadow-sm"
        style={{ backgroundColor: selected?.hex || "#e5e7eb" }}
        title={selected?.label ?? "Sem cor"}
      />

      <NativeSelect
        className="w-full"
        value={selected ? value : ""}
        disabled={disabled || colors.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {colors.length === 0 ? "Nenhuma cor disponível" : "Selecione a cor..."}
        </option>
        {colors.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
