"use client"

import { useVehicleColors } from "../../_hooks/useVehicleCatalog"

interface ColorSelectProps {
  value: string
  onChange: (colorName: string) => void
  disabled?: boolean
}

export function ColorSelect({ value, onChange, disabled }: ColorSelectProps) {
  const { data, isLoading } = useVehicleColors()
  const colors = data?.results ?? []
  const selected = colors.find((c) => c.name === value) ?? null

  // Se o catálogo está vazio ou o valor atual não está no catálogo,
  // renderiza input de texto livre em vez de select
  if (!isLoading && colors.length === 0) {
    return (
      <input
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        type="text"
        placeholder="Ex: Preta, Branca..."
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* Preview da cor */}
      <div
        className="h-6 w-6 shrink-0 rounded-full border border-border shadow-sm"
        style={{ backgroundColor: selected?.hex_code ?? "#e5e7eb" }}
        title={selected?.name ?? "Sem cor"}
      />

      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        value={value}
        disabled={disabled || isLoading}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione a cor...</option>
        {/* Se o valor atual não está no catálogo, mostra como opção extra */}
        {value && !selected && (
          <option value={value}>{value}</option>
        )}
        {colors.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
