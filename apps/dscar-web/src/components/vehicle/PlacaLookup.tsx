"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { onlyAlnum } from "@paddock/utils"

import { useLookup } from "@/hooks/useLookup"
import type { CatalogSelection, LookupResult } from "./catalog.schema"

type VehicleLookupKind = "placa" | "chassi"
type Found<K extends VehicleLookupKind> = Extract<LookupResult<K>, { found: true }>
export type PlacaFields = Found<"placa">["fields"]
export type ChassiResult = Found<"chassi">

/** Placa com 7+ caracteres; chassi com 17 caracteres de VIN (sem I, O e Q). */
const READY: Record<VehicleLookupKind, (v: string) => boolean> = {
  placa: (v) => v.length >= 7,
  chassi: (v) => /^[A-HJ-NPR-Z0-9]{17}$/.test(v),
}

const isFound = <K extends VehicleLookupKind>(r: LookupResult<K> | undefined): r is Found<K> =>
  r?.found === true

/**
 * Consulta a placa ou o chassi no blur ou no botão "Consultar", nunca a cada tecla.
 * `n` faz a mesma chave consultada de novo reaplicar o resultado (vem do cache).
 */
export function useVehicleLookup<K extends VehicleLookupKind>(
  kind: K,
  onFound: (fields: Found<K>["fields"]) => void,
) {
  const [key, setKey] = useState<{ value: string; n: number } | null>(null)
  const query = useLookup(kind, key?.value ?? null)
  const data = query.data

  useEffect(() => {
    if (isFound(data)) onFound(data.fields)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, key?.n])

  return {
    lookup: (raw: string | null | undefined) => {
      const v = onlyAlnum(raw ?? "").toUpperCase()
      // Campo apagado ou incompleto esquece o último resultado (dica e alerta não ficam órfãos).
      if (READY[kind](v)) setKey((k) => ({ value: v, n: (k?.n ?? 0) + 1 }))
      else setKey(null)
    },
    /** Esquece a última consulta (form novo não herda restrição nem dica de outro veículo). */
    reset: () => setKey(null),
    isFetching: query.isFetching,
    /** Já rodou uma consulta (achou ou não): libera o `SinespHint`. */
    searched: query.isFetched,
    notFound: data?.found === false || query.isError,
    /** Último resultado encontrado (restrição da placa, `source` do chassi). */
    result: isFound(data) ? data : null,
  }
}

/**
 * O que a placa ou o chassi sugere para o form (vai por `applyIfEmpty`, que nunca sobrescreve).
 * Com veículo já escolhido, o ano de fabricação da consulta não entra: é de outro veículo.
 */
export function placaPrefill(
  fields: Pick<PlacaFields, "vehicle" | "color" | "year_manufacture">,
  current: CatalogSelection | null | undefined,
) {
  const color = fields.color?.value
  if (current) return { color }
  return { color, catalog_selection: fields.vehicle, year_manufacture: fields.year_manufacture }
}

/** Ano-modelo pelo rótulo da versão ("2025 Flex", "Zero km Flex"); mesma regra do backend. */
function versionYear(label: string): number | null {
  if (label.startsWith("Zero km")) return new Date().getFullYear()
  const m = /^\d{4}/.exec(label)
  return m ? Number(m[0]) : null
}

/**
 * Ano de fabricação depois de uma troca no seletor. Completar o mesmo veículo (modelo, versão,
 * ano) mantém o da placa; outra montadora/família, ou versão cujo ano-modelo não é ym nem ym+1, zera.
 */
export function keepYearManufacture(
  prev: CatalogSelection | null | undefined,
  next: CatalogSelection | null,
  ym: number | null | undefined,
): number | null {
  if (ym == null || !prev || !next || next.make.id !== prev.make.id) return null
  if (prev.family && next.family?.id !== prev.family.id) return null
  if (!next.version) return ym
  const y = versionYear(next.version.label)
  return y === ym || y === ym + 1 ? ym : null
}

export function RestricaoAlert({ restricao }: { restricao: PlacaFields["restricao"] | undefined }) {
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

/** A placa não traz mais alerta de roubo/furto (API paga desligada): aponta o app oficial. */
export function SinespHint({ searched }: { searched: boolean }) {
  if (!searched) return null
  return (
    <p className="text-xs text-muted-foreground">
      Roubo/furto: confira no app Sinesp Cidadão.
    </p>
  )
}

/** Chassi sem OS anterior: diz de onde veio a sugestão, para o usuário completar ou conferir. */
export function ChassiHint({ result }: { result: ChassiResult | null }) {
  if (!result) return null
  const { vehicle, ano_modelo, confianca } = result.fields
  let text: string | null = null
  if (result.source === "vin" && vehicle)
    text = `Pelo chassi: ${vehicle.make.label}${ano_modelo ? `, ano-modelo ${ano_modelo}` : ""}`
  else if (result.source === "regra" && confianca === "alta")
    text = "Sugerido pelo chassi — confirme a versão"
  if (!text) return null
  return <p className="text-xs text-muted-foreground">{text}</p>
}
