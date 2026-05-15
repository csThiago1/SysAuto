"use client"

import { X } from "lucide-react"
import type { PartCatalogReference } from "@paddock/types"

interface CatalogContextCardProps {
  reference: PartCatalogReference
  onClear: () => void
}

export function CatalogContextCard({ reference, onClear }: CatalogContextCardProps) {
  const suppliers = reference.suppliers ?? []
  const applications = reference.applications ?? []
  const compatible = applications.filter((a) => a.confidence_score >= 50)

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
      <div className="flex items-start justify-between">
        <p className="font-medium text-foreground">
          Catalogo: {reference.manufacturer_code}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground p-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-foreground/70">
        <div>
          <span className="text-muted-foreground">Categoria:</span>{" "}
          {reference.category_name}
        </div>
        <div>
          <span className="text-muted-foreground">NCM:</span>{" "}
          {reference.ncm || "—"}
        </div>
      </div>

      {suppliers.length > 0 && (
        <div className="mt-2 text-xs text-foreground/70">
          <span className="text-muted-foreground">Fornecedores:</span>{" "}
          {suppliers.map((s) => s.supplier_name).join(" · ")}
        </div>
      )}

      {compatible.length > 0 ? (
        <div className="mt-2 text-xs">
          <span className="inline-flex items-center gap-1 text-success-500">
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
            Compativel:
          </span>{" "}
          <span className="text-foreground/70">
            {compatible
              .map((a) => {
                let text = a.make_nome
                if (a.model_nome) text += ` ${a.model_nome}`
                if (a.year_start) {
                  text += ` (${a.year_start}`
                  if (a.year_end && a.year_end !== a.year_start) text += `\u2013${a.year_end}`
                  text += ")"
                }
                return text
              })
              .join(", ")}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Sem dados de compatibilidade.
        </p>
      )}
    </div>
  )
}
