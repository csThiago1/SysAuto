"use client"

import { isToday, format, getHours } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { CalendarEventCard } from "./CalendarEventCard"
import { SchedulingDialog } from "./SchedulingDialog"
import type { CalendarEvent } from "@paddock/types"

/** Retorna os horários de expediente do dia, ou [] se fechado. */
function hoursForDay(date: Date): number[] {
  const dow = date.getDay() // 0=Dom, 6=Sáb
  if (dow === 0) return []                                           // Domingo
  if (dow === 6) return Array.from({ length: 5 }, (_, i) => i + 8) // 8h–12h
  return Array.from({ length: 10 }, (_, i) => i + 8)               // 8h–17h
}

/** Altura de cada linha de hora em px — deve ser igual ao min-h-[52px] da grade */
const HOUR_HEIGHT_PX = 52

/**
 * Calcula a posição vertical (px) do indicador de horário atual dentro da grade.
 * Retorna null se o horário atual estiver fora da grade visível.
 */
function useCurrentTimeTop(hours: number[]): number | null {
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  if (hours.length === 0) return null

  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()
  const startHour = hours[0]
  const endHour = hours[hours.length - 1]

  // Only render within [startHour, endHour + 1) window
  if (currentHour < startHour || currentHour > endHour) return null

  const minutesFromStart = (currentHour - startHour) * 60 + currentMinutes
  return minutesFromStart * (HOUR_HEIGHT_PX / 60)
}

interface Props {
  currentDate: Date
  events: CalendarEvent[]
}

export function DayView({ currentDate, events }: Props) {
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null)

  function handleSlotClick(hour: number) {
    const date = new Date(currentDate)
    date.setHours(hour, 0, 0, 0)
    setScheduleDate(date)
    setScheduleOpen(true)
  }

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

  const showingToday = isToday(currentDate)
  const currentTimeTop = useCurrentTimeTop(HOURS)

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className={cn("py-3 text-center border-b border-white/10", showingToday && "text-primary-600")}>
        <p className="text-sm font-semibold">{format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Dia fechado */}
        {isClosed && (
          <div className="flex items-center justify-center py-20 text-white/40 text-sm">
            Não há expediente aos domingos.
          </div>
        )}

        {!isClosed && (
          <>
            {/* Previsões sem hora */}
            {deliveries.length > 0 && (
              <div className="px-4 py-2 border-b border-white/10 bg-success-500/5 space-y-1">
                <p className="text-xs font-semibold uppercase text-success-400">Entregas previstas</p>
                {deliveries.map((e, i) => (
                  <CalendarEventCard key={`${e.os.id}-del-${i}`} event={e} />
                ))}
              </div>
            )}

            {/* Grade horária — relative para ancorar o indicador de horário atual */}
            <div className="relative">
              {HOURS.map((hour) => {
                const hourEvents = timed.filter((e) => e.datetime && getHours(e.datetime) === hour)
                return (
                  <div
                    key={hour}
                    className="flex gap-3 px-4 py-2 border-b border-white/10 min-h-[52px] cursor-pointer hover:bg-primary-600/5 transition-colors group"
                    onClick={() => handleSlotClick(hour)}
                  >
                    <span className="text-xs text-white/40 w-8 shrink-0 pt-0.5">{hour}h</span>
                    <div className="flex-1 min-w-0 space-y-1 relative">
                      {hourEvents.map((e, i) => (
                        <div key={`${e.os.id}-ent-${i}`} onClick={(ev) => ev.stopPropagation()}>
                          <CalendarEventCard event={e} />
                        </div>
                      ))}
                      {hourEvents.length === 0 && (
                        <span className="absolute inset-0 flex items-center text-xs text-primary-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          + Agendar
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Indicador de horário atual — só exibe ao visualizar hoje */}
              {showingToday && currentTimeTop !== null && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: `${currentTimeTop}px` }}
                >
                  {/* Bolinha vermelha alinhada à coluna de horários */}
                  <div className="absolute left-8 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-red-500" />
                  {/* Linha vermelha */}
                  <div className="ml-8 h-px bg-red-500 opacity-75" />
                </div>
              )}
            </div>
          </>
        )}
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
