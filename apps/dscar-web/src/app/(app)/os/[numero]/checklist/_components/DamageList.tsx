"use client"

import type { ReactElement } from "react"
import { ImageIcon } from "lucide-react"
import { DAMAGE_TYPES, PANEL_LABELS, SEVERITIES, SEVERITY_COLORS } from "@paddock/car-3d"

import { EmptyState } from "@/components/ui/empty-state"

import type { ChecklistDamage } from "../_schemas/checklist.schema"
import { BudgetDivergence } from "./BudgetDivergence"

const label = (opts: readonly { value: string; label: string }[], v: string): string =>
  opts.find((o) => o.value === v)?.label ?? v

export function DamageList({
  damages,
  onSelect,
}: {
  damages: ChecklistDamage[]
  onSelect: (damage: ChecklistDamage) => void
}): ReactElement {
  if (damages.length === 0) {
    return <EmptyState title="Nenhum dano marcado — toque numa peça do carro" className="py-10" />
  }
  return (
    <ul className="space-y-1.5">
      {damages.map((d) => (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onSelect(d)}
            className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-[11px] bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
          >
            <span
              className="row-span-2 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-black ring-2 ring-white/80"
              style={{ backgroundColor: SEVERITY_COLORS[d.severity] }}
            >
              {d.number}
            </span>
            <span className="truncate text-sm font-medium">{PANEL_LABELS[d.panel_key]}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {label(DAMAGE_TYPES, d.damage_type)} · {label(SEVERITIES, d.severity)}
              <span className="inline-flex items-center gap-0.5">
                <ImageIcon className="h-3 w-3" />
                {d.photos.length}
              </span>
              <BudgetDivergence relation={d.relation} budgetMatch={d.budget_match} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
