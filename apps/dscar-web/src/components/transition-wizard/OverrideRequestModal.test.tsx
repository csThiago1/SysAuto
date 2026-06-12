import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { OverrideRequestModal } from "./OverrideRequestModal"
import type { ValidationBlock } from "@paddock/types"

const SOFT_BLOCKS: ValidationBlock[] = [
  { code: "PHOTOS_MIN_12", message: "Faltam fotos da vistoria" },
  { code: "CLIENT_SIGNATURE", message: "Cliente ainda não assinou" },
]

function baseProps(overrides: Partial<React.ComponentProps<typeof OverrideRequestModal>> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    orderNumber: "1234",
    currentStatusLabel: "Recepção",
    targetStatusLabel: "Orçamento",
    softBlocks: SOFT_BLOCKS,
    reason: "",
    onReasonChange: vi.fn(),
    isSubmittingRemote: false,
    onManagerPresentClick: vi.fn(),
    onRemoteSubmit: vi.fn(),
    ...overrides,
  }
}

describe("OverrideRequestModal", () => {
  it("não renderiza nada quando open=false", () => {
    render(<OverrideRequestModal {...baseProps({ open: false })} />)
    expect(screen.queryByText(/Solicitar Liberação/i)).not.toBeInTheDocument()
  })

  it("mostra título com número da OS e os labels de transição", () => {
    render(<OverrideRequestModal {...baseProps()} />)
    expect(screen.getByText(/Solicitar Liberação — OS #1234/i)).toBeInTheDocument()
    expect(screen.getByText(/Recepção/)).toBeInTheDocument()
    expect(screen.getByText(/Orçamento/)).toBeInTheDocument()
  })

  it("lista todos os soft blocks com a mensagem do backend", () => {
    render(<OverrideRequestModal {...baseProps()} />)
    expect(screen.getByText("Faltam fotos da vistoria")).toBeInTheDocument()
    expect(screen.getByText("Cliente ainda não assinou")).toBeInTheDocument()
  })

  it("chama onReasonChange ao digitar no textarea", async () => {
    const user = userEvent.setup()
    const onReasonChange = vi.fn()
    render(<OverrideRequestModal {...baseProps({ onReasonChange })} />)
    await user.type(screen.getByRole("textbox", { name: /motivo/i }), "abc")
    expect(onReasonChange).toHaveBeenCalled()
  })

  it("desabilita 'Aprovação remota' enquanto reason está vazia", () => {
    render(<OverrideRequestModal {...baseProps({ reason: "   " })} />)
    expect(screen.getByRole("button", { name: /aprovação remota/i })).toBeDisabled()
  })

  it("habilita 'Aprovação remota' quando há reason preenchida", () => {
    render(<OverrideRequestModal {...baseProps({ reason: "cliente fora do estado" })} />)
    expect(screen.getByRole("button", { name: /aprovação remota/i })).not.toBeDisabled()
  })

  it("chama onRemoteSubmit ao clicar em 'Aprovação remota'", async () => {
    const user = userEvent.setup()
    const onRemoteSubmit = vi.fn()
    render(<OverrideRequestModal {...baseProps({ reason: "cliente fora", onRemoteSubmit })} />)
    await user.click(screen.getByRole("button", { name: /aprovação remota/i }))
    expect(onRemoteSubmit).toHaveBeenCalledTimes(1)
  })

  it("chama onManagerPresentClick ao clicar em 'Gerente presente'", async () => {
    const user = userEvent.setup()
    const onManagerPresentClick = vi.fn()
    render(<OverrideRequestModal {...baseProps({ reason: "ok", onManagerPresentClick })} />)
    await user.click(screen.getByRole("button", { name: /gerente presente/i }))
    expect(onManagerPresentClick).toHaveBeenCalledTimes(1)
  })

  it("mostra spinner em 'Aprovação remota' quando isSubmittingRemote=true", () => {
    render(<OverrideRequestModal {...baseProps({ reason: "ok", isSubmittingRemote: true })} />)
    const button = screen.getByRole("button", { name: /aprovação remota/i })
    expect(button).toBeDisabled()
    expect(button.querySelector(".animate-spin")).toBeInTheDocument()
  })
})
