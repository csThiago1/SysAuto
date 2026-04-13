"use client"

import { isToday, format, getHours } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { CalendarEventCard } from "./CalendarEventCard"
import type { CalendarEvent } from "@paddock/types"

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)

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

  const deliveries = dayEvents.filter((e) => e.type === "delivery")
  const entries = dayEvents.filter((e) => e.type === "entry")

  return (
    <div className="flex-1 overflow-auto max-w-xl mx-auto">
      <div className={cn("py-3 text-center border-b border-neutral-200", isToday(currentDate) && "text-[#ea0e03]")}>
        <p className="text-sm font-semibold">{format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
      </div>

      {deliveries.length > 0 && (
        <div className="px-4 py-2 border-b border-neutral-100 bg-emerald-50/50 space-y-1">
          <p className="text-[10px] font-semibold uppercase text-emerald-600">Entregas previstas</p>
          {deliveries.map((e, i) => (
            <CalendarEventCard key={`${e.os.id}-del-${i}`} event={e} />
          ))}
        </div>
      )}

      {HOURS.map((hour) => {
        const hourEvents = entries.filter((e) => e.datetime && getHours(e.datetime) === hour)
        return (
          <div key={hour} className="flex gap-3 px-4 py-2 border-b border-neutral-100 min-h-[52px]">
            <span className="text-[11px] text-neutral-400 w-8 shrink-0 pt-0.5">{hour}h</span>
            <div className="flex-1 space-y-1">
              {hourEvents.map((e, i) => (
                <CalendarEventCard key={`${e.os.id}-ent-${i}`} event={e} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
