"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "@paddock/types"
import { format } from "date-fns"

interface Props {
  event: CalendarEvent
  compact?: boolean
}

const EVENT_CONFIG = {
  entry:              { bg: "bg-blue-500",   label: "Entrada",   icon: "→" },
  delivery:           { bg: "bg-emerald-500", label: "Entrega",   icon: "↩" },
  scheduled_delivery: { bg: "bg-orange-500", label: "Retirada",  icon: "↩" },
} as const

export function CalendarEventCard({ event, compact = false }: Props) {
  const cfg = EVENT_CONFIG[event.type]
  const showTime = event.datetime !== null

  return (
    <Link
      href={`/service-orders/${event.os.id}`}
      className={cn(
        "block rounded px-1.5 py-0.5 text-white text-xs font-medium truncate hover:opacity-90 transition-opacity",
        cfg.bg,
        compact && "py-0"
      )}
      title={`${cfg.label}: ${event.os.plate} — ${event.os.customer_name}`}
    >
      {!compact && (
        <span className="mr-1 text-xs opacity-80">
          {showTime && event.datetime ? format(event.datetime, "HH:mm") : cfg.icon}
        </span>
      )}
      {event.os.plate}
      {!compact && (
        <span className="ml-1 opacity-80 text-xs">{event.os.customer_name.split(" ")[0]}</span>
      )}
    </Link>
  )
}
