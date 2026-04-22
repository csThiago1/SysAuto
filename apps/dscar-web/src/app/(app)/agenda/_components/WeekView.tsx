"use client"

import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isToday, format, getHours
} from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { CalendarEventCard } from "./CalendarEventCard"
import { SchedulingDialog } from "./SchedulingDialog"
import type { CalendarEvent } from "@paddock/types"

// Horários exibidos na grade: máximo do expediente (8h–17h)
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8)

// Máximo de eventos visíveis por célula hora/dia — excedente exibido como "+N mais"
const MAX_VISIBLE = 2

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
  onSwitchToDayView?: (date: Date) => void
}

export function WeekView({ currentDate, events, onSwitchToDayView }: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null)

  function handleSlotClick(day: Date, hour: number) {
    const date = new Date(day)
    date.setHours(hour, 0, 0, 0)
    setScheduleDate(date)
    setScheduleOpen(true)
  }

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
        <div className="grid border-b border-white/10" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div className="py-2" />
          {days.map((day) => {
            const isClosed = day.getDay() === 0
            return (
              <div
                key={day.toISOString()}
                className={cn("py-2 text-center", isToday(day) && "font-bold text-primary-600", isClosed && "opacity-40")}
              >
                <div className="text-xs uppercase text-white/40">
                  {format(day, "EEE", { locale: ptBR })}
                </div>
                <div className={cn("text-sm font-semibold", isToday(day) ? "text-primary-600" : "text-white/70")}>
                  {format(day, "d")}
                </div>
                {isClosed && <div className="text-xs text-white/40">Fechado</div>}
              </div>
            )
          })}
        </div>

        {/* Faixa "dia todo" — previsões sem hora exata */}
        {days.some((d) => allDayEvents(events, d).length > 0) && (
          <div className="grid border-b border-white/10 bg-emerald-50/60" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
            <div className="text-xs text-white/40 text-right pr-2 pt-1.5 leading-tight">
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
            <div className="text-xs text-white/40 text-right pr-2 pt-1">{hour}h</div>
            {days.map((day) => {
              const working = isWorkingHour(day, hour)
              const dayHourEvents = eventsForDayHour(day, hour)
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-l border-neutral-100 min-h-[64px] p-1 relative group overflow-hidden min-w-0",
                    working ? "cursor-pointer hover:bg-primary-600/5 transition-colors" : "bg-white/[0.03]"
                  )}
                  onClick={() => working && handleSlotClick(day, hour)}
                >
                  {working ? (
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {dayHourEvents.slice(0, MAX_VISIBLE).map((event, i) => (
                        <div key={`${event.os.id}-${event.type}-${i}`} onClick={(e) => e.stopPropagation()}>
                          <CalendarEventCard event={event} compact />
                        </div>
                      ))}
                      {dayHourEvents.length > MAX_VISIBLE && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSwitchToDayView?.(day) }}
                          className="text-[10px] text-primary-600 font-medium px-1 leading-tight hover:underline text-left w-full"
                        >
                          +{dayHourEvents.length - MAX_VISIBLE} mais
                        </button>
                      )}
                    </div>
                  ) : null}
                  {working && dayHourEvents.length === 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-primary-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      +
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {scheduleOpen && scheduleDate && (
        <SchedulingDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          defaultDate={scheduleDate}
        />
      )}
    </div>
  )
}
