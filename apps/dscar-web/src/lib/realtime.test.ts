import { afterEach, describe, expect, it, vi } from "vitest"
import {
  REALTIME_INVALIDATIONS,
  RealtimeEventSchema,
  TicketResponseSchema,
  realtimeUrl,
  reconnectDelayMs,
} from "./realtime"

afterEach(() => vi.unstubAllEnvs())

describe("RealtimeEventSchema", () => {
  it("aceita o evento da spec", () => {
    const ev = { entity: "service_order", id: "abc", action: "changed" }
    expect(RealtimeEventSchema.parse(ev)).toEqual(ev)
  })
  it("recusa entidade e ação desconhecidas", () => {
    expect(RealtimeEventSchema.safeParse({ entity: "foo", id: "1", action: "changed" }).success).toBe(false)
    expect(RealtimeEventSchema.safeParse({ entity: "service_order", id: "1", action: "deleted" }).success).toBe(false)
  })
})

describe("TicketResponseSchema", () => {
  it("exige ticket não vazio", () => {
    expect(TicketResponseSchema.safeParse({ ticket: "x" }).success).toBe(true)
    expect(TicketResponseSchema.safeParse({ ticket: "" }).success).toBe(false)
  })
})

describe("REALTIME_INVALIDATIONS", () => {
  it("service_order invalida lista, detalhe, timeline e dashboard", () => {
    expect(REALTIME_INVALIDATIONS.service_order).toEqual([
      ["service-orders"], ["service-order"], ["service-order-history"], ["dashboard-stats"],
    ])
  })
})

describe("reconnectDelayMs", () => {
  it("cresce em dobro e para em 30 s", () => {
    expect(reconnectDelayMs(0)).toBe(1000)
    expect(reconnectDelayMs(3)).toBe(8000)
    expect(reconnectDelayMs(10)).toBe(30000)
  })
})

describe("realtimeUrl", () => {
  it("dá null quando vazia", () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_WS_URL", "")
    expect(realtimeUrl()).toBeNull()
  })
  it("dá a URL quando definida", () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_WS_URL", "ws://localhost:8000/ws/realtime/")
    expect(realtimeUrl()).toBe("ws://localhost:8000/ws/realtime/")
  })
})
