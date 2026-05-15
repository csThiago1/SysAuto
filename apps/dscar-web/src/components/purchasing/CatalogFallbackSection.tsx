"use client"

import { BookOpen } from "lucide-react"
import { usePartsCatalog } from "@/hooks/usePartsCatalog"
import type { PartCatalogReference } from "@paddock/types"

interface CatalogFallbackSectionProps {
  searchTerm: string
  vehicleMakeName?: string
  vehicleModelName?: string
  vehicleLabel: string
  onSelect: (ref: PartCatalogReference) => void
}

export function CatalogFallbackSection({
  searchTerm,
  vehicleMakeName,
  vehicleModelName,
  vehicleLabel,
  onSelect,
}: CatalogFallbackSectionProps) {
  const { data: results, isLoading } = usePartsCatalog({
    search: searchTerm,
    vehicle_make_name: vehicleMakeName,
    vehicle_model_name: vehicleModelName,
  })

  if (isLoading) {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">Buscando no catalogo...</p>
      </div>
    )
  }

  if (!results || results.length === 0) return null

  const compatible = results.filter((r) => r.is_compatible)
  const others = results.filter((r) => !r.is_compatible)

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium text-foreground">
          Resultados do catalogo
        </h4>
      </div>

      {compatible.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-success-500 font-medium mb-2">
            Compativeis com {vehicleLabel}
          </p>
          <div className="space-y-1">
            {compatible.map((ref) => (
              <CatalogResultRow key={ref.id} ref_={ref} onSelect={onSelect} compatible />
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          {compatible.length > 0 && (
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Outros resultados
            </p>
          )}
          <div className="space-y-1">
            {others.map((ref) => (
              <CatalogResultRow key={ref.id} ref_={ref} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CatalogResultRow({
  ref_,
  onSelect,
  compatible = false,
}: {
  ref_: PartCatalogReference
  onSelect: (ref: PartCatalogReference) => void
  compatible?: boolean
}) {
  const suppliers = ref_.suppliers ?? []

  return (
    <button
      type="button"
      onClick={() => onSelect(ref_)}
      className="w-full text-left rounded-md border border-border bg-muted/30 hover:bg-muted/50 px-3 py-2.5 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground truncate block">
            {ref_.description}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {ref_.manufacturer_code}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">{ref_.category_name}</span>
          {compatible && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-success-500/10 text-success-500 border border-success-500/20">
              Compativel
            </span>
          )}
        </div>
      </div>
      {suppliers.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground truncate">
          Fornecedores: {suppliers.map((s) => s.supplier_name).join(" \u00b7 ")}
        </p>
      )}
    </button>
  )
}
