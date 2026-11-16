import { describe, expect, it } from "vitest"
import { atraso, ordenarPorUrgencia } from "./TorreDeTempos"

const HOJE = new Date(2026, 10, 16) // 16/11/2026, hora local

describe("atraso", () => {
  it("conta dias de atraso, hoje e folga", () => {
    expect(atraso("2026-11-11", HOJE)).toBe(5)
    expect(atraso("2026-11-16", HOJE)).toBe(0)
    expect(atraso("2026-11-20", HOJE)).toBe(-4)
    expect(atraso(null, HOJE)).toBeNull()
  })
})

describe("ordenarPorUrgencia", () => {
  it("atrasada primeiro, depois hoje, folga, e sem previsão no fim", () => {
    const os = [
      { id: "folga", estimated_delivery_date: "2026-11-20", days_in_shop: 1 },
      { id: "sem-data-velha", estimated_delivery_date: null, days_in_shop: 30 },
      { id: "hoje", estimated_delivery_date: "2026-11-16", days_in_shop: 3 },
      { id: "atraso-5", estimated_delivery_date: "2026-11-11", days_in_shop: 9 },
      { id: "sem-data-nova", estimated_delivery_date: null, days_in_shop: 2 },
      { id: "atraso-2", estimated_delivery_date: "2026-11-14", days_in_shop: 4 },
    ]
    expect(ordenarPorUrgencia(os, HOJE).map((o) => o.id)).toEqual([
      "atraso-5",
      "atraso-2",
      "hoje",
      "folga",
      "sem-data-velha",
      "sem-data-nova",
    ])
  })
})
