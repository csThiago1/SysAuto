"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { onlyAlnum } from "@paddock/utils"

import { useLookup } from "@/hooks/useLookup"
import type { CatalogSelection, LookupResult } from "./catalog.schema"

export type PlacaFields = Extract<LookupResult<"placa">, { found: true }>["fields"]

/** Consulta a placa no blur ou no botão "Consultar", nunca a cada tecla. */
export function usePlacaLookup(onFound: (fields: PlacaFields) => void) {
  const [key, setKey] = useState<string | null>(null)
  const query = useLookup("placa", key)
  const data = query.data

  useEffect(() => {
    if (data?.found) onFound(data.fields)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return {
    lookup: (plate: string | null | undefined) => {
      const p = onlyAlnum(plate ?? "").toUpperCase()
      if (p.length >= 7) setKey(p)
    },
    isFetching: query.isFetching,
    notFound: data?.found === false || query.isError,
    restricao: data?.found ? data.fields.restricao : null,
  }
}

/**
 * O que a placa sugere para o form (vai por `applyIfEmpty`, que nunca sobrescreve).
 * Com veículo já escolhido, o ano de fabricação da placa não entra: é de outro veículo.
 */
export function placaPrefill(fields: PlacaFields, current: CatalogSelection | null | undefined) {
  const color = fields.color?.value
  if (current) return { color }
  return { color, catalog_selection: fields.vehicle, year_manufacture: fields.year_manufacture }
}

export function RestricaoAlert({ restricao }: { restricao: PlacaFields["restricao"] }) {
  if (restricao?.tem_restricao !== true) return null
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md bg-warning-500/10 px-3 py-2 text-sm text-warning-400"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Restrição na placa: {restricao.situacao}</span>
    </p>
  )
}
