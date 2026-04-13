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
  scheduling_date: string | null      // ISO datetime — evento de entrada
  estimated_delivery_date: string | null  // YYYY-MM-DD — evento de entrega
}

export interface CalendarEvent {
  type: "entry" | "delivery"
  os: CalendarOS
  date: Date
  datetime: Date | null  // apenas para type=entry
}

export interface SchedulingPayload {
  scheduling_date: string | null      // ISO datetime
  repair_days: number | null
  estimated_delivery_date: string | null  // YYYY-MM-DD
}
