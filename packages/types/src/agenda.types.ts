export type CalendarView = "month" | "week" | "day"

export interface CalendarOS {
  id: string
  number: number
  plate: string
  make: string
  model: string
  customer_name: string
  customer_type: "private" | "insurer"
  status: string
  status_display: string
  scheduling_date: string | null          // ISO datetime — evento de entrada
  estimated_delivery_date: string | null  // YYYY-MM-DD — previsão (sem hora)
  delivery_date: string | null            // ISO datetime — agendamento de retirada (com hora)
}

export interface CalendarEvent {
  /** entry=entrada (azul), delivery=previsão s/hora (verde), scheduled_delivery=retirada agendada c/hora (laranja) */
  type: "entry" | "delivery" | "scheduled_delivery"
  os: CalendarOS
  date: Date
  datetime: Date | null  // null apenas para type=delivery (sem hora precisa)
}

export interface SchedulingPayload {
  scheduling_date: string | null      // ISO datetime
  repair_days: number | null
  estimated_delivery_date: string | null  // YYYY-MM-DD
}
