"use client"

import { useEffect, useRef, useState } from "react"
import {
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
} from "date-fns"
import { useCalendar, buildCalendarEvents } from "@/hooks/useAgenda"
import { CalendarHeader } from "./_components/CalendarHeader"
import { MonthView } from "./_components/MonthView"
import { WeekView } from "./_components/WeekView"
import { DayView } from "./_components/DayView"
import { SchedulingDialog } from "./_components/SchedulingDialog"
import type { CalendarView } from "@paddock/types"

export default function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarView>("month")
  const [schedulingOpen, setSchedulingOpen] = useState(false)
  const [schedulingDate, setSchedulingDate] = useState<Date | undefined>()

  // No celular a grade de mes nao cabe: cada celula fica com ~50px e nenhum
  // evento e legivel. Abre no Dia, que responde "o que entra/sai hoje".
  // Roda uma vez no mount (nao no SSR) e nunca sobrepoe uma escolha do usuario.
  const viewDefaulted = useRef(false)
  useEffect(() => {
    if (viewDefaulted.current) return
    viewDefaulted.current = true
    if (window.matchMedia("(max-width: 767px)").matches) setView("day")
  }, [])

  // Calcular range de datas para a view atual
  const dateRange = (() => {
    if (view === "month") {
      return {
        start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }),
      }
    }
    if (view === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      }
    }
    return { start: currentDate, end: currentDate }
  })()

  const { data: osData, isLoading } = useCalendar(dateRange.start, dateRange.end)
  const events = buildCalendarEvents(osData ?? [])

  function handleDayClick(date: Date) {
    setCurrentDate(date)
    setView("day")
  }

  function handleSchedule() {
    setSchedulingDate(currentDate)
    setSchedulingOpen(true)
  }

  const Legend = () => (
    <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-2 rounded bg-info-500" /> Entrada agendada
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-2 rounded bg-success-500" /> Previsão de entrega
      </span>
    </div>
  )

  return (
    <div className="flex flex-col h-full gap-2 px-0 py-3 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-lg font-semibold text-foreground md:text-2xl md:font-bold">Agenda</h1>

      <div className="bg-muted/50 rounded-md border border-border shadow-sm flex flex-col flex-1 overflow-hidden p-2 md:p-3">
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          onDateChange={setCurrentDate}
          onViewChange={setView}
          onSchedule={handleSchedule}
        />

        {/* Legenda so quando ha o que legendar */}
        {events.length > 0 && <Legend />}

        {isLoading && (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Carregando agenda...
          </div>
        )}

        {!isLoading && view === "month" && (
          <MonthView currentDate={currentDate} events={events} onDayClick={handleDayClick} />
        )}
        {!isLoading && view === "week" && (
          <WeekView currentDate={currentDate} events={events} onSwitchToDayView={handleDayClick} />
        )}
        {!isLoading && view === "day" && (
          <DayView currentDate={currentDate} events={events} />
        )}
      </div>

      <SchedulingDialog
        open={schedulingOpen}
        onOpenChange={setSchedulingOpen}
        defaultDate={schedulingDate}
      />
    </div>
  )
}
