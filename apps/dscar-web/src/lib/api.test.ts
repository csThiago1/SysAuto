import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }))
vi.mock("@/lib/offline/queue", () => ({ enqueueMutation: vi.fn(), isQueueable: () => false }))

import { apiFetch } from "./api"

function mensagemDe(status: number, corpo: unknown): Promise<string> {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(corpo), { status })))
  return apiFetch("/api/proxy/x/").then(
    () => "",
    (e: Error) => e.message,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe("apiFetch — mensagem de erro", () => {
  it("usa o detail em texto (403/404 do DRF)", async () => {
    expect(await mensagemDe(403, { detail: "Sem permissão." })).toBe("Sem permissão.")
  })

  it("usa o primeiro texto quando o valor vem em lista", async () => {
    expect(await mensagemDe(400, { detail: ["Título já recebido.", "outro"] })).toBe("Título já recebido.")
    expect(await mensagemDe(400, { non_field_errors: ["Não dá para cancelar título recebido."] })).toBe(
      "Não dá para cancelar título recebido.",
    )
    expect(await mensagemDe(400, { amount: ["Valor acima do saldo."] })).toBe("Valor acima do saldo.")
  })

  it("cai na mensagem genérica quando não há texto no corpo", async () => {
    expect(await mensagemDe(409, { action: "reconcile", items: [{ id: 1 }] })).toBe(
      "Ocorreu um erro na requisição.",
    )
  })
})
