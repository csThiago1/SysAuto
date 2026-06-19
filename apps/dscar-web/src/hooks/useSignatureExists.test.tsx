import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useSignatureExists } from "./useSignatureExists"

const apiFetchMock = vi.fn()
vi.mock("@/lib/api", () => ({ apiFetch: (...a: unknown[]) => apiFetchMock(...a) }))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe("useSignatureExists", () => {
  beforeEach(() => apiFetchMock.mockReset())

  it("retorna true quando count > 0", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 1, results: [] })
    const { result } = renderHook(
      () => useSignatureExists(42, "BUDGET_APPROVAL"),
      { wrapper: wrap() },
    )
    await waitFor(() => expect(result.current.data).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/proxy/signatures/?service_order=42&document_type=BUDGET_APPROVAL&page_size=1",
    )
  })

  it("retorna false quando count === 0", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 0, results: [] })
    const { result } = renderHook(
      () => useSignatureExists(42, "OS_DELIVERY"),
      { wrapper: wrap() },
    )
    await waitFor(() => expect(result.current.data).toBe(false))
  })

  it("não dispara query quando serviceOrderId é 0/falsy", () => {
    const { result } = renderHook(
      () => useSignatureExists(0, "BUDGET_APPROVAL"),
      { wrapper: wrap() },
    )
    expect(result.current.fetchStatus).toBe("idle")
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
