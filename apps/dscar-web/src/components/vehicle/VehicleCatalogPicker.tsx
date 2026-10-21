"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CatalogOption, CatalogSelection, VehicleTipo } from "./catalog.schema"
import { CatalogCombobox } from "./CatalogCombobox"
import { MakeLogo } from "./MakeLogo"

interface VehicleCatalogPickerProps {
  value: CatalogSelection | null
  onChange: (sel: CatalogSelection | null) => void
  /** Texto do veículo como veio da importação/placa, só para conferência. */
  sourceText?: string
  error?: string
  disabled?: boolean
}

const TIPOS: { value: VehicleTipo; label: string }[] = [
  { value: "carro", label: "Carro" },
  { value: "moto", label: "Moto" },
  { value: "caminhao", label: "Caminhão" },
]

const makeLogo = (o: CatalogOption) => <MakeLogo make={o} />

/** Seletor único do veículo: tipo → montadora → modelo (família) → versão FIPE → ano. */
export function VehicleCatalogPicker({
  value,
  onChange,
  sourceText,
  error,
  disabled,
}: VehicleCatalogPickerProps) {
  const [tipoSemValor, setTipoSemValor] = useState<VehicleTipo>("carro")
  const tipo = value?.tipo ?? tipoSemValor
  const empty = { family: null, model: null, version: null }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Tipo de veículo" className="inline-flex rounded-md border border-border p-0.5">
        {TIPOS.map((t) => (
          <button
            key={t.value}
            type="button"
            disabled={disabled}
            aria-pressed={tipo === t.value}
            onClick={() => {
              if (t.value === tipo) return
              setTipoSemValor(t.value)
              if (value) onChange(null) // a montadora é de um tipo só
            }}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium disabled:opacity-50",
              tipo === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CatalogCombobox
          label="Montadora"
          level="makes"
          params={{ tipo }}
          value={value?.make ?? null}
          icon={makeLogo}
          disabled={disabled}
          onChange={(make) => onChange({ tipo, make, ...empty })}
        />
        <CatalogCombobox
          label="Modelo"
          level="families"
          params={{ marca: value?.make.id }}
          value={value?.family ?? null}
          disabled={disabled || !value}
          onChange={(family) => value && onChange({ ...value, family, model: null, version: null })}
        />
        <CatalogCombobox
          label="Versão"
          level="models"
          params={{ familia: value?.family?.id }}
          value={value?.model ?? null}
          disabled={disabled || !value?.family}
          onChange={(model) => value && onChange({ ...value, model, version: null })}
        />
        <CatalogCombobox
          label="Ano"
          level="years"
          params={{ modelo: value?.model?.id }}
          value={value?.version ?? null}
          disabled={disabled || !value?.model}
          onChange={(version) => value && onChange({ ...value, version })}
        />
      </div>

      {value?.family && !value.version && <Badge variant="warning">Versão a confirmar</Badge>}
      {sourceText && (
        <p className="text-xs text-muted-foreground">Como veio da fonte: {sourceText}</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
