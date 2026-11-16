// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

// auth(handler) do next-auth: injeta req.auth e devolve o Set-Cookie da sessão
// renovada na resposta final. O mock reproduz as duas coisas.
vi.mock("@/lib/auth", () => ({
  auth:
    (fn: (req: unknown, ctx: unknown) => Promise<Response>) =>
    async (req: { auth?: unknown }, ctx: unknown) => {
      req.auth = { accessToken: "t", activeCompany: "dscar" }
      const res = await fn(req, ctx)
      const final = new Response(res.body, res)
      final.headers.append("set-cookie", "authjs.session-token=renovado; Path=/")
      return final
    },
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

    const res = (await GET(req, { params: Promise.resolve({ path: ["service-orders"] }) })) as Response

    expect(res.status).toBe(401)
    expect(log).toHaveBeenCalled()
    const logged = JSON.stringify(log.mock.calls)
    expect(logged).not.toContain("search=")
    expect(logged).not.toContain("8AC907655SE254082")
  })

  it("usa o token da sessão e devolve o cookie renovado", async () => {
    const f = vi.fn().mockResolvedValue(Response.json([], { status: 200 }))
    vi.stubGlobal("fetch", f)
    const req = new NextRequest("http://localhost/api/proxy/service-orders")

    const res = (await GET(req, { params: Promise.resolve({ path: ["service-orders"] }) })) as Response

    expect(res.status).toBe(200)
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer t")
    expect(res.headers.get("set-cookie")).toContain("authjs.session-token=renovado")
  })
})
