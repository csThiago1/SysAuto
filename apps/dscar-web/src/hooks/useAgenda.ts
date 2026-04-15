"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { format } from "date-fns"
import type { CalendarOS, CalendarEvent, SchedulingPayload } from "@paddock/types"

const API = "/api/proxy/service-orders"

export const agendaKeys = {
  all: ["agenda"] as const,
  calendar: (start: string, end: string) => [...agendaKeys.all, start, end] as const,
}

export function useCalendar(dateStart: Date, dateEnd: Date) {
  const start = format(dateStart, "yyyy-MM-dd")
  const end = format(dateEnd, "yyyy-MM-dd")

  return useQuery({
    queryKey: agendaKeys.calendar(start, end),
    queryFn: () =>
      apiFetch<CalendarOS[]>(`${API}/calendar/?date_start=${start}&date_end=${end}`),
    staleTime: 60_000,
  })
}

/** Converte lista de CalendarOS em CalendarEvent[] para renderização */
export function buildCalendarEvents(items: CalendarOS[]): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const os of items) {
    if (os.scheduling_date) {
      const dt = new Date(os.scheduling_date)
      events.push({ type: "entry", os, date: dt, datetime: dt })
    }
    // Se há agendamento de retirada com hora, usa ele como evento preciso.
    // Caso contrário, usa a previsão de data (sem hora precisa).
    if (os.delivery_date) {
      const dt = new Date(os.delivery_date)
      events.push({ type: "scheduled_delivery", os, date: dt, datetime: dt })
    } else if (os.estimated_delivery_date) {
      const dt = new Date(os.estimated_delivery_date + "T12:00:00")
      events.push({ type: "delivery", os, date: dt, datetime: null })
    }
  }

  return events
}

export function useScheduleOS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ osId, payload }: { osId: string; payload: SchedulingPayload }) =>
      apiFetch(`${API}/${osId}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agendaKeys.all })
      qc.invalidateQueries({ queryKey: ["service-orders"] })
    },
  })
}
