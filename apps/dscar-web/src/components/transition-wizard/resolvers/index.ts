import type React from "react"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"
import { FallbackResolver } from "./FallbackResolver"
import { DataResolver } from "./DataResolver"
import { PhotoResolver } from "./PhotoResolver"
import { InsurerResolver } from "./InsurerResolver"
import { FileResolver } from "./FileResolver"
import { CancelJustificationResolver } from "./CancelJustificationResolver"
import { SignatureResolver } from "./SignatureResolver"
import { SIGNATURE_CODE_MAP } from "@/components/signatures/signatureCodeMap"

export interface ResolverProps {
  block: ValidationBlock
  order: ServiceOrder
  onResolved: () => void
}

const REGISTRY = new Map<string, React.ComponentType<ResolverProps>>()

export function registerResolver(
  codes: readonly string[],
  component: React.ComponentType<ResolverProps>,
): void {
  for (const code of codes) REGISTRY.set(code, component)
}

export function getResolver(code: string): React.ComponentType<ResolverProps> {
  return REGISTRY.get(code) ?? FallbackResolver
}

export function hasResolverFor(code: string): boolean {
  return REGISTRY.has(code)
}

// Fase 2 (entregue)
registerResolver(
  ["VEHICLE_BASIC_DATA", "CUSTOMER_TYPE_SET", "MILEAGE_OUT", "FUEL_TYPE", "MILEAGE_IN", "CUSTOMER_LINKED"],
  DataResolver,
)
registerResolver(["PHOTOS_MIN_12", "FINAL_PHOTOS_12", "PROGRESS_PHOTO"], PhotoResolver)

// Fase 4 — 9 novos codes
registerResolver(
  ["VEHICLE_COLOR", "VEHICLE_YEAR", "DEDUCTIBLE_SET", "CASUALTY_NUMBER", "AUTH_DATE_SET", "ENTRY_DATE_SET"],
  DataResolver,
)
registerResolver(["INSURER_DATA"], InsurerResolver)
registerResolver(["BUDGET_PDF_INSURER"], FileResolver)
registerResolver(["CANCEL_JUSTIFICATION"], CancelJustificationResolver)

// Sprint B — Signature (data-driven: todos os codes do mapa apontam pro mesmo resolver)
registerResolver(Object.keys(SIGNATURE_CODE_MAP), SignatureResolver)
