"use client"

import type { ReactElement } from "react"

import { ChecklistSection } from "../../vistoria/_components/ChecklistSection"
import type { EntryChecklistState } from "../_schemas/checklist.schema"

/** Itens do veículo (parada 6): o ChecklistItem atual, sem lataria, vidros e iluminação. */
export function ItemsTab({
  osId,
  summary,
  locked,
}: {
  osId: string
  summary: EntryChecklistState["items_summary"]
  locked: boolean
}): ReactElement {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {summary.ok} presentes · {summary.attention} com avaria · {summary.critical} faltando
        {summary.pending > 0 && ` · ${summary.pending} pendentes`}
      </p>
      <ChecklistSection osId={osId} checklistType="entrada" disabled={locked} />
    </div>
  )
}
