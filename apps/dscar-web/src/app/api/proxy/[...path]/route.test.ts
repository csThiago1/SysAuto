// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ accessToken: "t", activeCompany: "dscar" }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("proxy", () => {
  it("log de erro não leva a query string (busca por chassi, placa ou nome)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "x" }, { status: 401 })))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const req = new NextRequest("http://localhost/api/proxy/service-orders?search=8AC907655SE254082")

    const res = await GET(req, { params: Promise.resolve({ path: ["service-orders"] }) })

    expect(res.status).toBe(401)
    expect(log).toHaveBeenCalled()
    const logged = JSON.stringify(log.mock.calls)
    expect(logged).not.toContain("search=")
    expect(logged).not.toContain("8AC907655SE254082")
  })
})
