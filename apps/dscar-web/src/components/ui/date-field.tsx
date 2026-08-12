"use client"

/**
 * DateField — seletor de data (e hora) próprio.
 *
 * Substitui `input[type=date]` / `input[type=datetime-local]`: o controle
 * nativo traz o calendário do sistema operacional, que ignora o tema do app,
 * muda de aparência entre navegadores e mostra "dd/mm/aaaa" cinza mesmo quando
 * há valor. Aqui o gatilho é um campo comum do design system e o calendário é
 * desenhado com os mesmos tokens do resto da tela.
 *
 * Contrato igual ao do input nativo, pra trocar sem tocar no schema:
 *   withTime=false → "yyyy-MM-dd"
 *   withTime=true  → "yyyy-MM-ddTHH:mm"
 */

import { useMemo, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react"
import { FORM_INPUT } from "@paddock/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"]

interface DateFieldProps {
  value?: string | null
  onChange: (value: string) => void
  withTime?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
  id?: string
}

function parse(value?: string | null): Date | null {
  if (!value) return null
  const d = parseISO(value)
  return isValid(d) ? d : null
}

export function DateField({
  value,
  onChange,
  withTime = false,
  placeholder,
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  id,
}: DateFieldProps) {
  const selected = parse(value)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState<Date>(selected ?? new Date())

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [cursor])

  /** Mantém a hora já escolhida ao trocar só o dia. */
  function commitDate(day: Date) {
    if (!withTime) {
      onChange(format(day, "yyyy-MM-dd"))
      setOpen(false)
      return
    }
    const hh = selected ? format(selected, "HH:mm") : "08:00"
    onChange(`${format(day, "yyyy-MM-dd")}T${hh}`)
  }

  function commitTime(hhmm: string) {
    const base = selected ?? new Date()
    onChange(`${format(base, "yyyy-MM-dd")}T${hhmm || "00:00"}`)
  }

  const label = selected
    ? format(selected, withTime ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy", { locale: ptBR })
    : (placeholder ?? (withTime ? "Escolher data e hora" : "Escolher data"))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            FORM_INPUT,
            "items-center justify-between gap-2 text-left",
            !selected && "text-muted-foreground/60",
            className,
          )}
        >
          <span className={cn("truncate", selected && "font-mono tabular-nums")}>{label}</span>
          <span className="flex shrink-0 items-center gap-1">
            {selected && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Limpar data"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange("")
                  }
                }}
                className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <CalendarDays className="h-4 w-4 text-muted-foreground/60" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-3">
        {/* Navegação do mês */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground first-letter:uppercase">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="label-mono py-1 text-center">
              {d}
            </span>
          ))}
          {days.map((day) => {
            const isSel = selected ? isSameDay(day, selected) : false
            const inMonth = isSameMonth(day, cursor)
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => commitDate(day)}
                aria-current={isSel ? "date" : undefined}
                className={cn(
                  "h-9 w-9 rounded-md font-mono text-[13px] tabular-nums transition-colors",
                  isSel
                    ? "bg-primary font-semibold text-primary-foreground"
                    : inMonth
                      ? "text-foreground/80 hover:bg-muted/60"
                      : "text-muted-foreground/35 hover:bg-muted/40",
                  !isSel && isToday(day) && "ring-1 ring-inset ring-primary/50",
                )}
              >
                {format(day, "d")}
              </button>
            )
          })}
        </div>

        {withTime && (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <label className="label-mono shrink-0">Hora</label>
            <input
              type="time"
              value={selected ? format(selected, "HH:mm") : ""}
              onChange={(e) => commitTime(e.target.value)}
              className={cn(FORM_INPUT, "h-8 font-mono tabular-nums")}
            />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => {
              const now = new Date()
              setCursor(now)
              commitDate(now)
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Fechar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
