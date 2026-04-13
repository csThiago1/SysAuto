"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "@paddock/types"
import { format } from "date-fns"

interface Props {
  event: CalendarEvent
  compact?: boolean
}

export function CalendarEventCard({ event, compact = false }: Props) {
  const isEntry = event.type === "entry"

  return (
    <Link
      href={`/service-orders/${event.os.id}`}
      className={cn(
        "block rounded px-1.5 py-0.5 text-white text-[10px] font-medium truncate hover:opacity-90 transition-opacity",
        isEntry ? "bg-blue-500" : "bg-emerald-500",
        compact && "py-0"
      )}
      title={`${isEntry ? "Entrada" : "Entrega"}: ${event.os.plate} — ${event.os.customer_name}`}
    >
      {!compact && (
        <span className="mr-1 text-[9px] opacity-80">
          {isEntry && event.datetime ? format(event.datetime, "HH:mm") : "↩"}
        </span>
      )}
      {event.os.plate}
      {!compact && (
        <span className="ml-1 opacity-80 text-[9px]">{event.os.customer_name.split(" ")[0]}</span>
      )}
    </Link>
  )
}
