"use client"

/**
 * Linha do tempo da OS — substitui a parede de inputs datetime.
 *
 * Cada marco é uma linha com estado (feito/pendente), valor formatado e
 * ações; o input de data só aparece quando o usuário decide editar.
 */

import { useState } from "react"
import { useWatch, type UseFormReturn } from "react-hook-form"
import { Check, Pencil, X, Zap } from "lucide-react"
import { formatDateTime } from "@paddock/utils"
import { cn } from "@/lib/utils"
import { DateField } from "@/components/ui/date-field"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"

type DateField =
  | "scheduling_date"
  | "entry_date"
  | "service_authorization_date"
  | "final_survey_date"
  | "client_delivery_date"

interface Milestone {
  field: DateField
  label: string
  /** Efeito colateral ao preencher (mostrado como ⚡ + tooltip) */
  statusHint?: string
}

// Hints abaixo espelham AUTO_TRANSITION_FIELDS (useAutoTransition.ts) — os únicos
// campos desta timeline que de fato disparam transição automática ao salvar.
// entry_date NÃO dispara transição ao ser preenchido aqui: é o inverso — o backend
// preenche entry_date sozinho ao entrar em "initial_survey" (order_service.py).
const MILESTONES: Milestone[] = [
  { field: "scheduling_date", label: "Agendamento", statusHint: "Preencher muda o status → Vistoria Inicial" },
  { field: "entry_date", label: "Entrada do veículo" },
  { field: "service_authorization_date", label: "Autorização do serviço" },
  { field: "final_survey_date", label: "Vistoria final", statusHint: "Preencher muda o status → Vistoria Final" },
  { field: "client_delivery_date", label: "Retirada pelo cliente", statusHint: "Preencher muda o status → Entregue" },
]

function nowLocal(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

interface MilestoneTimelineProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function MilestoneTimeline({ form }: MilestoneTimelineProps) {
  const { control, setValue } = form
  const values = useWatch({ control, name: MILESTONES.map((m) => m.field) })
  const [editing, setEditing] = useState<DateField | null>(null)
  const [draft, setDraft] = useState("")

  function set(field: DateField, value: string | null) {
    setValue(field, value as never, { shouldDirty: true })
    setEditing(null)
  }

  return (
    <ol>
      {MILESTONES.map((m, i) => {
        const value = values[i] as string | null | undefined
        const done = !!value
        const isEditing = editing === m.field
        const isLast = i === MILESTONES.length - 1

        return (
          <li key={m.field} className="relative flex gap-3 pb-1">
            {/* Trilho */}
            <div className="flex flex-col items-center pt-1.5">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full border-2",
                  done
                    ? "border-success-500 bg-success-500"
                    : "border-muted-foreground/40 bg-transparent",
                )}
              />
              {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
            </div>

            {/* Conteúdo */}
            <div className="flex min-h-[2.1rem] flex-1 items-start justify-between gap-3 pb-1.5">
              <div className="pt-0.5">
                <p className="inline-flex items-center gap-1.5 text-sm text-foreground/80">
                  {m.label}
                  {m.statusHint && !done && <Zap className="h-3 w-3 text-warning-400/80" />}
                </p>
                {/* Visível sempre, não só no hover — no touch/mobile um <title> nunca aparece */}
                {m.statusHint && !done && (
                  <p className="text-[11px] text-warning-400/80">{m.statusHint}</p>
                )}
                {done && !isEditing && (
                  <p className="font-mono text-xs text-muted-foreground">{formatDateTime(value)}</p>
                )}
              </div>

              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <div className="min-w-0 flex-1">
                    <DateField withTime value={draft} onChange={setDraft} />
                  </div>
                  <button
                    type="button"
                    onClick={() => set(m.field, draft || null)}
                    aria-label="Confirmar data"
                    className="rounded-md bg-success-500/15 p-1.5 text-success-400 hover:bg-success-500/25"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    aria-label="Cancelar edição"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/40"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  {!done && (
                    <button
                      type="button"
                      onClick={() => set(m.field, nowLocal())}
                      className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                      Agora
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(value ? value.slice(0, 16) : "")
                      setEditing(m.field)
                    }}
                    aria-label={done ? `Editar ${m.label}` : `Definir ${m.label}`}
                    className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    {done ? <Pencil className="h-3 w-3" /> : "Definir"}
                  </button>
                  {done && (
                    <button
                      type="button"
                      onClick={() => set(m.field, null)}
                      aria-label={`Limpar ${m.label}`}
                      className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-error-500/10 hover:text-error-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
