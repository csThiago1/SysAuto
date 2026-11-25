import React from "react"
import { act, render } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RealtimeProvider } from "./RealtimeProvider"

class FakeWS {
  static instances: FakeWS[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  close = vi.fn()
  constructor(public url: string) {
    FakeWS.instances.push(this)
  }
}

const fetchMock = vi.fn()
const evento = JSON.stringify({ entity: "service_order", id: "1", action: "changed" })

async function montar() {
  const qc = new QueryClient()
  const spy = vi.spyOn(qc, "invalidateQueries")
  const { unmount } = render(
    <QueryClientProvider client={qc}>
      <RealtimeProvider />
    </QueryClientProvider>,
  )
  await act(async () => {})
  return { qc, spy, unmount }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeWS.instances = []
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ticket: "t1" }) })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("WebSocket", FakeWS)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("RealtimeProvider", () => {
  it("sem env não cria WebSocket nem pede ticket", async () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_WS_URL", "")
    await montar()
    expect(FakeWS.instances).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("evento de OS invalida os prefixos uma vez por rajada", async () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_WS_URL", "ws://x/ws/")
    const { spy } = await montar()
    expect(FakeWS.instances[0].url).toBe("ws://x/ws/?ticket=t1")
    act(() => FakeWS.instances[0].onopen?.())
    act(() => {
      for (let i = 0; i < 5; i++) FakeWS.instances[0].onmessage?.({ data: evento })
    })
    expect(spy).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(300))
    expect(spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey)).toEqual([
      ["service-orders"],
      ["service-order"],
      ["service-order-history"],
      ["dashboard-stats"],
    ])
  })

  it("mensagem inválida é ignorada", async () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_WS_URL", "ws://x/ws/")
    const { spy } = await montar()
    act(() => {
      FakeWS.instances[0].onmessage?.({ data: "{" })
      FakeWS.instances[0].onmessage?.({ data: JSON.stringify({ entity: "foo" }) })
      vi.advanceTimersByTime(300)
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it("reconexão espera e pede ticket novo", async () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_WS_URL", "ws://x/ws/")
    const { spy } = await montar()
    act(() => FakeWS.instances[0].onopen?.())
    expect(spy).not.toHaveBeenCalled() // primeira conexão não invalida tudo
    act(() => FakeWS.instances[0].onclose?.())
    await act(async () => vi.advanceTimersByTime(999))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(1))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(FakeWS.instances).toHaveLength(2)
    act(() => FakeWS.instances[1].onopen?.())
    expect(spy).toHaveBeenCalledWith()
  })

  it("falha do ticket reconecta e unmount não reconecta", async () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_WS_URL", "ws://x/ws/")
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    const { unmount } = await montar()
    expect(FakeWS.instances).toHaveLength(0)
    await act(async () => vi.advanceTimersByTime(1000))
    expect(FakeWS.instances).toHaveLength(1)
    unmount()
    expect(FakeWS.instances[0].close).toHaveBeenCalled()
    FakeWS.instances[0].onclose?.()
    await act(async () => vi.advanceTimersByTime(60000))
    expect(FakeWS.instances).toHaveLength(1)
  })
})
