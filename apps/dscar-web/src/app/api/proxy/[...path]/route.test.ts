// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "./route"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ accessToken: "t", activeCompany: "dscar" }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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

  // A assinatura remota é evidência: o backend precisa do IP e do navegador do cliente,
  // não do servidor do Next nem do fetch do Node.
  function sentHeaders(fetchMock: ReturnType<typeof vi.fn>): Headers {
    return new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
  }

  function confirmRequest(headers: Record<string, string>): NextRequest {
    return new NextRequest("http://localhost/api/proxy/public/checklist-confirm/tok/", {
      method: "POST",
      body: JSON.stringify({ signer_name: "x" }),
      headers: { "Content-Type": "application/json", ...headers },
    })
  }

  it("repassa IP do cliente, navegador e segredo do proxy", async () => {
    vi.stubEnv("PROXY_SHARED_SECRET", "segredo")
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ signed_at: "x" }))
    vi.stubGlobal("fetch", fetchMock)
    const req = confirmRequest({
      "x-forwarded-for": "203.0.113.7, 10.0.0.2",
      "user-agent": "Mozilla/5.0 (iPhone)",
    })

    await POST(req, { params: Promise.resolve({ path: ["public", "checklist-confirm", "tok"] }) })

    const headers = sentHeaders(fetchMock)
    expect(headers.get("X-Client-IP")).toBe("203.0.113.7")
    expect(headers.get("User-Agent")).toBe("Mozilla/5.0 (iPhone)")
    expect(headers.get("X-Proxy-Secret")).toBe("segredo")
  })

  it("usa x-real-ip sem x-forwarded-for e não manda segredo vazio", async () => {
    vi.stubEnv("PROXY_SHARED_SECRET", "")
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ signed_at: "x" }))
    vi.stubGlobal("fetch", fetchMock)

    await POST(confirmRequest({ "x-real-ip": "198.51.100.4" }), {
      params: Promise.resolve({ path: ["public", "checklist-confirm", "tok"] }),
    })

    const headers = sentHeaders(fetchMock)
    expect(headers.get("X-Client-IP")).toBe("198.51.100.4")
    expect(headers.has("X-Proxy-Secret")).toBe(false)
  })
})
