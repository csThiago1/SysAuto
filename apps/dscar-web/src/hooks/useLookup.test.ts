import { createElement, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "@/lib/api"
import { useLookup } from "./useLookup"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe("useLookup", () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset())

  it("found:false é estado normal, não erro", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      found: false,
      source: "none",
      fields: {},
      unmatched: [],
    })
    const { result } = renderHook(() => useLookup("cep", "69000000"), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.isError).toBe(false)
    expect(result.current.data?.found).toBe(false)
    expect(apiFetch).toHaveBeenCalledWith("/api/proxy/lookups/cep/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "69000000" }),
    })
  })

  it("payload fora do schema vira erro", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      found: true,
      source: "viacep",
      fields: { cep: 69000000 },
      unmatched: [],
    })
    const { result } = renderHook(() => useLookup("cep", "69000000"), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it("não dispara com key null", async () => {
    const { result } = renderHook(() => useLookup("placa", null), { wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(apiFetch).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe("idle")
  })
})
