import { describe, expect, it } from "vitest"
import { montarOrcamento } from "./OrcamentoTab"

describe("montarOrcamento", () => {
  it("junta peças e serviços na ordem de entrada e soma cada grupo", () => {
    const { linhas, totalPecas, totalServicos } = montarOrcamento(
      [
        {
          id: "p1",
          description: "Lanterna",
          origem: "compra",
          origem_display: "Compra",
          status_peca: "aguardando_cotacao",
          quantity: "2.00",
          total: "236.00",
          created_at: "2026-11-24T10:05:00Z",
        },
      ],
      [
        { id: "s1", description: "Funilaria porta", quantity: "1.00", total: 450, created_at: "2026-11-24T10:00:00Z" },
        { id: "s2", description: "Pintura", quantity: "1.00", total: "350.50", created_at: "2026-11-24T10:10:00Z" },
      ],
    )
    expect(linhas.map((l) => l.id)).toEqual(["s1", "p1", "s2"])
    expect(linhas[1]).toMatchObject({ kind: "peca", detail: "Peça · Compra", quantity: 2, total: 236 })
    expect(totalPecas).toBe(236)
    expect(totalServicos).toBeCloseTo(800.5)
  })

  it("orçamento vazio soma zero", () => {
    expect(montarOrcamento([], [])).toEqual({ linhas: [], totalPecas: 0, totalServicos: 0 })
  })
})
