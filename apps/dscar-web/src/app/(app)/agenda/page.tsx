"use client"

import { useState } from "react"
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
    <div className="flex items-center gap-4 text-xs text-neutral-500 px-1">
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-2 rounded bg-blue-500" /> Entrada agendada
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-3 h-2 rounded bg-emerald-500" /> Previsão de entrega
      </span>
    </div>
  )

  return (
    <div className="flex flex-col h-full gap-2 p-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Agenda</h1>
        <p className="text-sm text-neutral-500">Visualize e gerencie agendamentos de entrada e entrega das OS.</p>
      </div>

      <div className="bg-white rounded-md border border-neutral-200 shadow-sm flex flex-col flex-1 overflow-hidden p-3">
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          onDateChange={setCurrentDate}
          onViewChange={setView}
          onSchedule={handleSchedule}
        />

        <Legend />

        {isLoading && (
          <div className="flex-1 flex items-center justify-center text-sm text-neutral-400">
            Carregando agenda...
          </div>
        )}

        {!isLoading && view === "month" && (
          <MonthView currentDate={currentDate} events={events} onDayClick={handleDayClick} />
        )}
        {!isLoading && view === "week" && (
          <WeekView currentDate={currentDate} events={events} />
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
