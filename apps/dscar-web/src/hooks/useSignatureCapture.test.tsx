import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useSignatureCapture } from "./useSignatureCapture"
import type { CapturePayload, Signature } from "@/components/signatures/types"

const apiFetchMock = vi.fn()
vi.mock("@/lib/api", () => ({ apiFetch: (...a: unknown[]) => apiFetchMock(...a) }))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe("useSignatureCapture", () => {
  beforeEach(() => apiFetchMock.mockReset())

  it("faz POST /signatures/capture/ com method CANVAS_TABLET injetado", async () => {
    const signature: Signature = {
      id: 1,
      document_type: "BUDGET_APPROVAL",
      method: "CANVAS_TABLET",
      signer_name: "João",
      signer_cpf: null,
      signed_at: "2026-06-19T10:00:00Z",
      signature_hash: "abc",
    }
    apiFetchMock.mockResolvedValueOnce(signature)

    const { result } = renderHook(() => useSignatureCapture(), { wrapper: wrap() })

    const payload: CapturePayload = {
      service_order_id: 42,
      document_type: "BUDGET_APPROVAL",
      signer_name: "João",
      signature_png_base64: "iVBORw0KGgo=",
    }

    result.current.mutate(payload)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/proxy/signatures/capture/",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    )
    const sentBody = JSON.parse(apiFetchMock.mock.calls[0][1].body as string)
    expect(sentBody).toMatchObject({ ...payload, method: "CANVAS_TABLET" })
    expect(result.current.data).toEqual(signature)
  })
})
