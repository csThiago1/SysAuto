import { describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { createElement } from "react"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))

import { apiFetch } from "@/lib/api"
import { damagesKey, useFinalizeChecklist } from "./useEntryChecklist"

const state = {
  id: "7d2f1e0a-1b2c-4d3e-8f90-a1b2c3d4e5f6",
  body_type: "sedan",
  suggested_body_type: null,
  stops_done: {},
  finalized_at: "2026-11-10T12:00:00Z",
  version: 2,
  signature_status: "pendente",
  pdf_url: null,
  vehicle_color_hex: "#9a9a9a",
  customer_type: "private",
  items_summary: { ok: 0, attention: 0, critical: 0, pending: 0 },
  vehicle_make: null,
  vehicle_family: null,
  allow_nc_models: false,
}

describe("useFinalizeChecklist", () => {
  it("invalida os danos, porque o finalize recruza o orçamento (budget_match)", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(state)
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const invalidate = vi.spyOn(qc, "invalidateQueries")
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)
    const { result } = renderHook(() => useFinalizeChecklist("os-1"), { wrapper })

    await result.current.mutateAsync({ snapshots: {}, model_credit: null })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: damagesKey("os-1") })
  })
})
