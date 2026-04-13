"use client"

import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, format, getHours
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { CalendarEventCard } from "./CalendarEventCard"
import type { CalendarEvent } from "@paddock/types"

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 7h–20h

interface Props {
  currentDate: Date
  events: CalendarEvent[]
}

export function WeekView({ currentDate, events }: Props) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  function eventsForDayHour(day: Date, hour: number): CalendarEvent[] {
    return events.filter((e) => {
      if (!isSameDay(e.date, day)) return false
      if (e.type === "delivery") return hour === 7 // entregas ficam no topo
      if (e.datetime) return getHours(e.datetime) === hour
      return false
    })
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[640px]">
        {/* Cabeçalho com dias */}
        <div className="grid border-b border-neutral-200" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div className="py-2" />
          {days.map((day) => (
            <div key={day.toISOString()} className={cn("py-2 text-center", isToday(day) && "font-bold text-[#ea0e03]")}>
              <div className="text-[11px] uppercase text-neutral-400">
                {format(day, "EEE", { locale: ptBR })}
              </div>
              <div className={cn("text-sm font-semibold", isToday(day) ? "text-[#ea0e03]" : "text-neutral-700")}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Grade de horas */}
        {HOURS.map((hour) => (
          <div key={hour} className="grid border-b border-neutral-100" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            <div className="text-[10px] text-neutral-400 text-right pr-2 pt-1">{hour}h</div>
            {days.map((day) => {
              const dayHourEvents = eventsForDayHour(day, hour)
              return (
                <div key={day.toISOString()} className="border-l border-neutral-100 min-h-[52px] p-1 space-y-0.5">
                  {dayHourEvents.map((event, i) => (
                    <CalendarEventCard key={`${event.os.id}-${event.type}-${i}`} event={event} />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
