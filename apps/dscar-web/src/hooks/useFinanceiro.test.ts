import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn(), fetchList: vi.fn() }))

import { apiFetch } from "@/lib/api"
import { fetchAllReceivables } from "./useFinanceiro"

const titulo = (id: string) => ({
  id,
  customer_name: "Cliente",
  description: "OS 1",
  document_number: "",
  due_date: "2026-11-30",
  competence_date: "2026-11-01",
  amount: "100.00",
  amount_received: "0.00",
  amount_remaining: "100.00",
  status: "open",
  origin: "OS",
  service_order_id: null,
  created_at: "2026-11-01T10:00:00Z",
})

beforeEach(() => vi.mocked(apiFetch).mockReset())

describe("fetchAllReceivables", () => {
  it("segue as páginas enquanto houver next e junta os resultados", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ count: 3, next: "http://backend/?page=2", previous: null, results: [titulo("a"), titulo("b")] })
      .mockResolvedValueOnce({ count: 3, next: null, previous: "x", results: [titulo("c")] })

    const data = await fetchAllReceivables({ status: "open" })

    expect(data.count).toBe(3)
    expect(data.results.map((d) => d.id)).toEqual(["a", "b", "c"])
    const urls = vi.mocked(apiFetch).mock.calls.map(([url]) => String(url))
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain("status=open")
    expect(urls[0]).toContain("page=1&page_size=200")
    expect(urls[1]).toContain("page=2&page_size=200")
  })

  it("recusa item fora do contrato em vez de mostrar dado torto", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ count: 1, next: null, previous: null, results: [{ id: "a" }] })
    await expect(fetchAllReceivables()).rejects.toThrow()
  })
})
