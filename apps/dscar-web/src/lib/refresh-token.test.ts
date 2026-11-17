import { afterEach, describe, expect, it, vi } from "vitest"
import { RefreshTransitorio, refreshAccessToken } from "./refresh-token"

const PAR = { access: "novo-access", refresh: "novo-refresh" }

function mockFetch(resposta: Response) {
  const f = vi.fn().mockResolvedValue(resposta)
  vi.stubGlobal("fetch", f)
  return f
}

afterEach(() => vi.unstubAllGlobals())

describe("refreshAccessToken", () => {
  it("manda refresh_token (o campo que o backend lê)", async () => {
    const f = mockFetch(new Response(JSON.stringify(PAR), { status: 200 }))
    expect(await refreshAccessToken("http://api", "token-a")).toEqual(PAR)
    expect(f).toHaveBeenCalledWith("http://api/api/v1/auth/refresh/", expect.objectContaining({ method: "POST" }))
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ refresh_token: "token-a" })
  })

  it("renova uma vez só por token, mesmo com chamadas em paralelo", async () => {
    const f = mockFetch(new Response(JSON.stringify(PAR), { status: 200 }))
    const [a, b, c] = await Promise.all([
      refreshAccessToken("http://api", "token-b"),
      refreshAccessToken("http://api", "token-b"),
      refreshAccessToken("http://api", "token-b"),
    ])
    expect(f).toHaveBeenCalledTimes(1)
    expect(a).toEqual(PAR)
    expect(b).toEqual(PAR)
    expect(c).toEqual(PAR)
  })

  it("falha passageira (502, rede) lança e não fica em cache", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(PAR), { status: 200 }))
    vi.stubGlobal("fetch", f)
    await expect(refreshAccessToken("http://api", "token-d")).rejects.toBeInstanceOf(RefreshTransitorio)
    expect(await refreshAccessToken("http://api", "token-d")).toEqual(PAR)
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("devolve null quando o backend recusa", async () => {
    mockFetch(new Response(JSON.stringify({ detail: "x" }), { status: 401 }))
    expect(await refreshAccessToken("http://api", "token-c")).toBeNull()
  })
})
