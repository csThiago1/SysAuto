"use client"

import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, format, getHours
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { CalendarEventCard } from "./CalendarEventCard"
import type { CalendarEvent } from "@paddock/types"

// Horários exibidos na grade: máximo do expediente (8h–17h)
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8)

/** Retorna true se o horário está dentro do expediente do dia. */
function isWorkingHour(day: Date, hour: number): boolean {
  const dow = day.getDay() // 0=Dom, 1=Seg … 5=Sex, 6=Sáb
  if (dow === 0) return false                    // Domingo: fechado
  if (dow === 6) return hour >= 8 && hour <= 12  // Sábado: 8h–12h
  return hour >= 8 && hour <= 17                 // Seg–Sex: 8h–17h
}

/** Eventos sem hora exata (previsão de entrega) para exibir na faixa "dia todo". */
function allDayEvents(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => isSameDay(e.date, day) && e.type === "delivery")
}

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
      if (e.type === "delivery") return false // tratado na faixa "dia todo"
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
          {days.map((day) => {
            const isClosed = day.getDay() === 0
            return (
              <div
                key={day.toISOString()}
                className={cn("py-2 text-center", isToday(day) && "font-bold text-primary-600", isClosed && "opacity-40")}
              >
                <div className="text-xs uppercase text-neutral-400">
                  {format(day, "EEE", { locale: ptBR })}
                </div>
                <div className={cn("text-sm font-semibold", isToday(day) ? "text-primary-600" : "text-neutral-700")}>
                  {format(day, "d")}
                </div>
                {isClosed && <div className="text-xs text-neutral-400">Fechado</div>}
              </div>
            )
          })}
        </div>

        {/* Faixa "dia todo" — previsões sem hora exata */}
        {days.some((d) => allDayEvents(events, d).length > 0) && (
          <div className="grid border-b border-neutral-200 bg-emerald-50/40" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            <div className="text-xs text-neutral-400 text-right pr-2 pt-1.5 leading-tight">
              dia<br />todo
            </div>
            {days.map((day) => {
              const dayAll = allDayEvents(events, day)
              return (
                <div key={day.toISOString()} className="border-l border-neutral-100 p-1 space-y-0.5 min-h-[28px]">
                  {dayAll.map((e, i) => (
                    <CalendarEventCard key={`${e.os.id}-all-${i}`} event={e} compact />
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* Grade de horas */}
        {HOURS.map((hour) => (
          <div key={hour} className="grid border-b border-neutral-100" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            <div className="text-xs text-neutral-400 text-right pr-2 pt-1">{hour}h</div>
            {days.map((day) => {
              const working = isWorkingHour(day, hour)
              const dayHourEvents = eventsForDayHour(day, hour)
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-l border-neutral-100 min-h-[52px] p-1 space-y-0.5",
                    !working && "bg-neutral-50"
                  )}
                >
                  {working
                    ? dayHourEvents.map((event, i) => (
                        <CalendarEventCard key={`${event.os.id}-${event.type}-${i}`} event={event} />
                      ))
                    : null
                  }
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
