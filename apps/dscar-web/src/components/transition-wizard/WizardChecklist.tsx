"use client"

import { WizardItem } from "./WizardItem"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"

interface WizardChecklistProps {
  hardBlocks: ValidationBlock[]
  softBlocks: ValidationBlock[]
  warnings: ValidationBlock[]
  resolvedCodes: Set<string>
  order: ServiceOrder
  onResolved: (code: string) => void
}

export function WizardChecklist({
  hardBlocks,
  softBlocks,
  warnings,
  resolvedCodes,
  order,
  onResolved,
}: WizardChecklistProps) {
  return (
    <ul className="space-y-2" role="list" aria-label="Pendências da transição">
      {hardBlocks.map((b) => (
        <WizardItem
          key={b.code}
          block={b}
          severity="hard"
          isResolved={resolvedCodes.has(b.code)}
          order={order}
          onResolved={() => onResolved(b.code)}
        />
      ))}
      {softBlocks.map((b) => (
        <WizardItem
          key={b.code}
          block={b}
          severity="soft"
          isResolved={resolvedCodes.has(b.code)}
          order={order}
          onResolved={() => onResolved(b.code)}
        />
      ))}
      {warnings.map((b) => (
        <WizardItem
          key={b.code}
          block={b}
          severity="warning"
          isResolved={resolvedCodes.has(b.code)}
          order={order}
          onResolved={() => onResolved(b.code)}
        />
      ))}
    </ul>
  )
}
