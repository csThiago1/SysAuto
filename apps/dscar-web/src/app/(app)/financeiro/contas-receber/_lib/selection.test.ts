import { describe, expect, it } from "vitest"

import { hasBalance, headerState, reconcile, toggle, toggleAll, total } from "./selection"

const doc = (id: string, amount_remaining = "100.00", status: "open" | "partial" | "received" | "overdue" | "cancelled" = "open") => ({
  id,
  status,
  amount_remaining,
})

describe("seleção de títulos a receber", () => {
  it("só título aberto, parcial ou vencido com saldo é selecionável", () => {
    expect(hasBalance(doc("a"))).toBe(true)
    expect(hasBalance(doc("a", "10.00", "partial"))).toBe(true)
    expect(hasBalance(doc("a", "10.00", "overdue"))).toBe(true)
    expect(hasBalance(doc("a", "0.00", "received"))).toBe(false)
    expect(hasBalance(doc("a", "100.00", "cancelled"))).toBe(false)
    expect(hasBalance(doc("a", "0.00", "open"))).toBe(false)
  })

  it("marca e desmarca guardando o saldo", () => {
    const marked = toggle({}, doc("a", "150.50"))
    expect(marked).toEqual({ a: "150.50" })
    expect(toggle(marked, doc("a", "150.50"))).toEqual({})
  })

  it("mantém o que foi marcado em outra busca ao marcar todos os visíveis", () => {
    const fromOtherSearch = { x: "40.00" }
    const visible = [doc("a", "10.00"), doc("b", "20.00"), doc("c", "0.00", "received")]

    expect(headerState(fromOtherSearch, visible)).toBe(false)
    const all = toggleAll(fromOtherSearch, visible)
    expect(all).toEqual({ x: "40.00", a: "10.00", b: "20.00" })
    expect(headerState(all, visible)).toBe(true)
    expect(headerState(toggle(all, visible[0]), visible)).toBe("indeterminate")

    // desmarcar todos tira só os visíveis
    expect(toggleAll(all, visible)).toEqual(fromOtherSearch)
  })

  it("lista sem título selecionável deixa o cabeçalho desmarcado", () => {
    expect(headerState({ x: "40.00" }, [doc("c", "0.00", "received")])).toBe(false)
  })

  it("ao recarregar, tira quem ficou sem saldo e atualiza o saldo de quem recebeu parte", () => {
    const selection = { a: "100.00", b: "100.00", fora: "30.00" }
    const loaded = [doc("a", "0.00", "received"), doc("b", "60.00", "partial"), doc("z")]

    expect(reconcile(selection, loaded)).toEqual({ b: "60.00", fora: "30.00" })
  })

  it("quem sumiu da lista com o mesmo filtro sai da seleção", () => {
    const selection = { a: "100.00", fora: "30.00" }
    expect(reconcile(selection, [doc("b")], ["a"])).toEqual({ fora: "30.00" })
  })

  it("recarregar sem mudança devolve a mesma seleção", () => {
    const selection = { a: "100.00" }
    expect(reconcile(selection, [doc("a"), doc("b")])).toBe(selection)
  })

  it("soma os saldos sem erro de centavos", () => {
    expect(total({})).toBe(0)
    expect(total({ a: "0.10", b: "0.20" })).toBe(0.3)
    expect(total({ a: "1234.56", b: "765.44", c: "0.01" })).toBe(2000.01)
  })
})
