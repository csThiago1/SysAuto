import { describe, expect, it } from "vitest"
import { MutationObserver } from "@tanstack/react-query"
import { getQueryClient } from "./query-client"

describe("getQueryClient", () => {
  it("mutação que deu certo invalida queries de outras chaves", async () => {
    const client = getQueryClient()
    client.setQueryData(["service-orders", { is_active: "true" }], { count: 1 })
    await new MutationObserver(client, { mutationFn: async () => "ok" }).mutate()
    expect(client.getQueryState(["service-orders", { is_active: "true" }])?.isInvalidated).toBe(true)
  })

  it("mutação que falhou não invalida", async () => {
    const client = getQueryClient()
    client.setQueryData(["dashboard-stats", "MANAGER"], { role: "manager" })
    const falha = new MutationObserver(client, {
      mutationFn: async () => {
        throw new Error("400")
      },
    })
    await falha.mutate().catch(() => undefined)
    expect(client.getQueryState(["dashboard-stats", "MANAGER"])?.isInvalidated).toBe(false)
  })
})
