"use client"

import { isToday, format, getHours } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { CalendarEventCard } from "./CalendarEventCard"
import type { CalendarEvent } from "@paddock/types"

/** Retorna os horários de expediente do dia, ou [] se fechado. */
function hoursForDay(date: Date): number[] {
  const dow = date.getDay() // 0=Dom, 6=Sáb
  if (dow === 0) return []                                           // Domingo
  if (dow === 6) return Array.from({ length: 5 }, (_, i) => i + 8) // 8h–12h
  return Array.from({ length: 10 }, (_, i) => i + 8)               // 8h–17h
}

interface Props {
  currentDate: Date
  events: CalendarEvent[]
}

export function DayView({ currentDate, events }: Props) {
  const dayEvents = events.filter((e) => {
    const d = e.date
    return (
      d.getFullYear() === currentDate.getFullYear() &&
      d.getMonth() === currentDate.getMonth() &&
      d.getDate() === currentDate.getDate()
    )
  })

  const HOURS = hoursForDay(currentDate)
  const isClosed = HOURS.length === 0
  const deliveries = dayEvents.filter((e) => e.type === "delivery")
  const timed = dayEvents.filter((e) => e.type === "entry" || e.type === "scheduled_delivery")

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className={cn("py-3 text-center border-b border-neutral-200", isToday(currentDate) && "text-primary-600")}>
        <p className="text-sm font-semibold">{format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Dia fechado */}
        {isClosed && (
          <div className="flex items-center justify-center py-20 text-neutral-400 text-sm">
            Não há expediente aos domingos.
          </div>
        )}

        {!isClosed && (
          <>
            {/* Previsões sem hora */}
            {deliveries.length > 0 && (
              <div className="px-4 py-2 border-b border-neutral-100 bg-emerald-50/50 space-y-1">
                <p className="text-xs font-semibold uppercase text-emerald-600">Entregas previstas</p>
                {deliveries.map((e, i) => (
                  <CalendarEventCard key={`${e.os.id}-del-${i}`} event={e} />
                ))}
              </div>
            )}

            {/* Grade horária */}
            {HOURS.map((hour) => {
              const hourEvents = timed.filter((e) => e.datetime && getHours(e.datetime) === hour)
              return (
                <div key={hour} className="flex gap-3 px-4 py-2 border-b border-neutral-100 min-h-[52px]">
                  <span className="text-xs text-neutral-400 w-8 shrink-0 pt-0.5">{hour}h</span>
                  <div className="flex-1 min-w-0 space-y-1">
                    {hourEvents.map((e, i) => (
                      <CalendarEventCard key={`${e.os.id}-ent-${i}`} event={e} />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
