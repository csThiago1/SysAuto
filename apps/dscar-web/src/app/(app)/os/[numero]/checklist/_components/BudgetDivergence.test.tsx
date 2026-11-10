import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { BudgetDivergence } from "./BudgetDivergence"

describe("BudgetDivergence", () => {
  it("relação sinistro e peça fora do orçamento mostra a divergência", () => {
    render(<BudgetDivergence relation="sinistro" budgetMatch="fora_do_orcamento" />)

    expect(screen.getByText("Divergência")).toBeInTheDocument()
    expect(screen.getByText("Pré-existente · fora do sinistro")).toBeInTheDocument()
  })

  it("sem divergência quando o dano está no orçamento", () => {
    render(<BudgetDivergence relation="sinistro" budgetMatch="no_orcamento" />)

    expect(screen.queryByText("Divergência")).not.toBeInTheDocument()
  })
})
