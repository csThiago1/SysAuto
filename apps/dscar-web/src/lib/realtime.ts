import type { QueryKey } from "@tanstack/react-query"
import { z } from "zod"

// Evento do websocket: só avisa que algo mudou; o dado vem pela API de sempre.
export const RealtimeEventSchema = z.object({
  entity: z.enum(["service_order"]),
  id: z.string(),
  action: z.literal("changed"),
})
export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>

export const TicketResponseSchema = z.object({ ticket: z.string().min(1) })

// Prefixos de query usados hoje pela lista, Kanban, detalhe, timeline e dashboard.
export const REALTIME_INVALIDATIONS: Record<RealtimeEvent["entity"], readonly QueryKey[]> = {
  service_order: [["service-orders"], ["service-order"], ["service-order-history"], ["dashboard-stats"]],
}

// Espera crescente entre reconexões: 1 s, 2 s, 4 s... até 30 s.
export function reconnectDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30000)
}

// Literal obrigatório: o Next só inlina NEXT_PUBLIC_* quando acessada assim.
export function realtimeUrl(): string | null {
  return process.env.NEXT_PUBLIC_REALTIME_WS_URL || null
}
