"use client"

import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, isToday,
  format
} from "date-fns"
import { cn } from "@/lib/utils"
import { CalendarEventCard } from "./CalendarEventCard"
import type { CalendarEvent } from "@paddock/types"

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

interface Props {
  currentDate: Date
  events: CalendarEvent[]
  onDayClick: (date: Date) => void
}

export function MonthView({ currentDate, events, onDayClick }: Props) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  function eventsForDay(day: Date): CalendarEvent[] {
    return events.filter((e) => isSameDay(e.date, day))
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Cabeçalho dias da semana */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase text-white/40">
            {d}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const dayEvents = eventsForDay(day)
          const inMonth = isSameMonth(day, currentDate)
          const today = isToday(day)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-b border-r border-white/10 p-1.5 cursor-pointer hover:bg-white/[0.03] transition-colors min-h-[100px]",
                !inMonth && "bg-white/[0.02]",
              )}
              onClick={() => onDayClick(day)}
            >
              <div className={cn(
                "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                today ? "bg-primary-600 text-white" : inMonth ? "text-white/70" : "text-white/30",
              )}>
                {format(day, "d")}
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event, i) => (
                  <CalendarEventCard key={`${event.os.id}-${event.type}-${i}`} event={event} compact />
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-xs text-white/40 pl-1">+{dayEvents.length - 3} mais</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
