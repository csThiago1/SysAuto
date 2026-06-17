import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { CancelJustificationResolver } from "./CancelJustificationResolver"
import { JustificationProvider } from "../JustificationContext"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"
import { useState } from "react"

const ORDER = { id: "os-1" } as unknown as ServiceOrder
const BLOCK: ValidationBlock = { code: "CANCEL_JUSTIFICATION", message: "Justificativa obrigatória" }

function Wrapper({ children }: { children: React.ReactNode }) {
  const [justification, setJustification] = useState("")
  return (
    <JustificationProvider value={{ justification, setJustification }}>
      {children}
    </JustificationProvider>
  )
}

describe("CancelJustificationResolver", () => {
  it("renderiza textarea com placeholder", () => {
    render(
      <Wrapper>
        <CancelJustificationResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />
      </Wrapper>
    )
    expect(screen.getByRole("textbox", { name: /motivo do cancelamento/i })).toBeInTheDocument()
  })

  it("não chama onResolved com texto curto (<10 chars)", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    render(
      <Wrapper>
        <CancelJustificationResolver block={BLOCK} order={ORDER} onResolved={onResolved} />
      </Wrapper>
    )
    await user.type(screen.getByRole("textbox", { name: /motivo do cancelamento/i }), "curto")
    expect(onResolved).not.toHaveBeenCalled()
  })

  it("chama onResolved quando texto >= 10 chars", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    render(
      <Wrapper>
        <CancelJustificationResolver block={BLOCK} order={ORDER} onResolved={onResolved} />
      </Wrapper>
    )
    await user.type(screen.getByRole("textbox", { name: /motivo do cancelamento/i }), "cliente desistiu")
    expect(onResolved).toHaveBeenCalled()
  })

  it("mostra contador de caracteres", async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <CancelJustificationResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />
      </Wrapper>
    )
    await user.type(screen.getByRole("textbox", { name: /motivo do cancelamento/i }), "abc")
    expect(screen.getByText(/3.*10/)).toBeInTheDocument()
  })
})
