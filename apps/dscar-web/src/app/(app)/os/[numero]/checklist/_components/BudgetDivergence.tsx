"use client"

import { useState, type ReactElement } from "react"
import { toast } from "sonner"
import { PANEL_KEYS, PANEL_LABELS, RELATIONS, type PanelKey } from "@paddock/car-3d"

import { NativeSelect } from "@/components/ui/native-select"
import { usePermission } from "@/hooks/usePermission"

import { useCreatePanelRule } from "../_hooks/useEntryChecklist"
import type { ChecklistDamage, MatchSummary } from "../_schemas/checklist.schema"

const MATCH_BADGE: Record<ChecklistDamage["budget_match"], { label: string; color: string }> = {
  no_orcamento: { label: "No orçamento", color: "#0aa52b" },
  fora_do_orcamento: { label: "Pré-existente · fora do sinistro", color: "#ff8a00" },
  sem_orcamento: { label: "Sem orçamento", color: "#8c8c8c" },
}

function Pill({ label, color }: { label: string; color: string }): ReactElement {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, borderColor: `${color}66`, backgroundColor: `${color}1a` }}
    >
      {label}
    </span>
  )
}

/** Selo do cruzamento; a relação declarada nunca é sobrescrita, só posta ao lado quando diverge. */
export function BudgetDivergence({
  relation,
  budgetMatch,
}: {
  relation: ChecklistDamage["relation"]
  budgetMatch: ChecklistDamage["budget_match"]
}): ReactElement {
  const badge = <Pill {...MATCH_BADGE[budgetMatch]} />
  if (relation !== "sinistro" || budgetMatch !== "fora_do_orcamento") return badge
  const declared = RELATIONS.find((r) => r.value === relation)?.label ?? relation
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-error-400">Divergência</span>
      <Pill label={`Declarado: ${declared}`} color="#d9d9d9" />
      {badge}
    </span>
  )
}

/** Itens do orçamento que o dicionário não reconhece; o ADMIN liga cada um a uma peça (vira regra). */
export function UnmappedBudgetItems({
  osId,
  items,
}: {
  osId: string
  items: MatchSummary["unmapped"]
}): ReactElement | null {
  const isAdmin = usePermission("ADMIN")
  const createRule = useCreatePanelRule()
  const [linked, setLinked] = useState<ReadonlySet<number>>(new Set())
  const pending = items.filter((i) => !linked.has(i.item_id))
  if (pending.length === 0) return null

  async function link(itemId: number, description: string, panel: PanelKey): Promise<void> {
    try {
      await createRule.mutateAsync({ pattern: description, panel_keys: [panel], service_order_id: osId })
      setLinked((s) => new Set(s).add(itemId))
      toast.success("Peça ligada. O cruzamento foi refeito.")
    } catch {
      toast.error("Não deu para salvar a ligação. Tente de novo.")
    }
  }

  return (
    <section className="space-y-2 rounded-[11px] border border-warning-500/30 bg-warning-500/5 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-warning-400">
        Itens do orçamento sem peça ({pending.length})
      </h3>
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">Peça a um administrador para ligar estes itens a uma peça.</p>
      )}
      <ul className="space-y-2">
        {pending.map((item) => (
          <li key={item.item_id} className="space-y-1">
            <p className="text-sm">{item.description}</p>
            {isAdmin && (
              <NativeSelect
                aria-label={`Peça de ${item.description}`}
                defaultValue=""
                disabled={createRule.isPending}
                onChange={(e) => {
                  const panel = PANEL_KEYS.find((k) => k === e.target.value)
                  if (panel) void link(item.item_id, item.description, panel)
                }}
              >
                <option value="" disabled>
                  Ligar a uma peça…
                </option>
                {PANEL_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PANEL_LABELS[key]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
