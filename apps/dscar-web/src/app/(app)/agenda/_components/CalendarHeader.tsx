"use client"

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import {
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfWeek, endOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import type { CalendarView } from "@paddock/types"

const VIEW_LABELS: Record<CalendarView, string> = {
  month: "Mês",
  week: "Semana",
  day: "Dia",
}

interface Props {
  currentDate: Date
  view: CalendarView
  onDateChange: (date: Date) => void
  onViewChange: (view: CalendarView) => void
  onSchedule: () => void
}

export function CalendarHeader({ currentDate, view, onDateChange, onViewChange, onSchedule }: Props) {
  function goBack() {
    if (view === "month") onDateChange(subMonths(currentDate, 1))
    else if (view === "week") onDateChange(subWeeks(currentDate, 1))
    else onDateChange(subDays(currentDate, 1))
  }

  function goForward() {
    if (view === "month") onDateChange(addMonths(currentDate, 1))
    else if (view === "week") onDateChange(addWeeks(currentDate, 1))
    else onDateChange(addDays(currentDate, 1))
  }

  function getLabel(): string {
    if (view === "month") return format(currentDate, "MMMM yyyy", { locale: ptBR })
    if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      const end = endOfWeek(currentDate, { weekStartsOn: 0 })
      return `${format(start, "d MMM", { locale: ptBR })} – ${format(end, "d MMM yyyy", { locale: ptBR })}`
    }
    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })
  }

  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={goBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold text-neutral-800 capitalize min-w-[200px] text-center">
          {getLabel()}
        </h2>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={goForward}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-neutral-500"
          onClick={() => onDateChange(new Date())}
        >
          Hoje
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {/* Seletor de view */}
        <div className="flex rounded-md border border-neutral-200 bg-white p-0.5">
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <Button onClick={onSchedule} size="sm" className="bg-primary-600 hover:bg-primary-700 text-white gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Agendar
        </Button>
      </div>
    </div>
  )
}
