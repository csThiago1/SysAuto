import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { WizardFooter } from "./WizardFooter"

function baseProps(overrides = {}) {
  return {
    targetLabel: "Reparo",
    allBlockingResolved: false,
    hasSoftBlocks: false,
    isAdvancing: false,
    onAdvance: vi.fn(),
    onRequestOverride: vi.fn(),
    ...overrides,
  }
}

describe("WizardFooter", () => {
  it("mostra texto neutro quando pendências não resolvidas", () => {
    render(<WizardFooter {...baseProps()} />)
    expect(screen.getByText(/resolva os itens/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /avançar/i })).not.toBeInTheDocument()
  })

  it("mostra banner verde + botão avançar quando tudo resolvido", () => {
    render(<WizardFooter {...baseProps({ allBlockingResolved: true })} />)
    expect(screen.getByRole("button", { name: /avançar para reparo/i })).toBeInTheDocument()
  })

  it("chama onAdvance ao clicar no botão verde", async () => {
    const user = userEvent.setup()
    const onAdvance = vi.fn()
    render(<WizardFooter {...baseProps({ allBlockingResolved: true, onAdvance })} />)
    await user.click(screen.getByRole("button", { name: /avançar para reparo/i }))
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it("mostra spinner no botão quando isAdvancing=true", () => {
    render(<WizardFooter {...baseProps({ allBlockingResolved: true, isAdvancing: true })} />)
    const btn = screen.getByRole("button", { name: /avançar para reparo/i })
    expect(btn).toBeDisabled()
    expect(btn.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("mostra link de override quando há soft blocks e pendências", () => {
    render(<WizardFooter {...baseProps({ hasSoftBlocks: true })} />)
    expect(screen.getByRole("button", { name: /solicitar liberação/i })).toBeInTheDocument()
  })

  it("não mostra link de override quando não há soft blocks", () => {
    render(<WizardFooter {...baseProps({ hasSoftBlocks: false })} />)
    expect(screen.queryByRole("button", { name: /solicitar liberação/i })).not.toBeInTheDocument()
  })

  it("chama onRequestOverride ao clicar no link", async () => {
    const user = userEvent.setup()
    const onRequestOverride = vi.fn()
    render(<WizardFooter {...baseProps({ hasSoftBlocks: true, onRequestOverride })} />)
    await user.click(screen.getByRole("button", { name: /solicitar liberação/i }))
    expect(onRequestOverride).toHaveBeenCalledTimes(1)
  })
})
