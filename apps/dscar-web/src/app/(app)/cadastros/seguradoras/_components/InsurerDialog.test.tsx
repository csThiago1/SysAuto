import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { InsurerDialog } from "./InsurerDialog"

const create = vi.fn(async () => ({ id: "novo" }))
const idle = { mutateAsync: vi.fn(), isPending: false }

vi.mock("@/hooks/useInsurers", () => ({
  useInsurer: () => ({ data: undefined, isError: false }),
  useInsurerCreate: () => ({ mutateAsync: create, isPending: false }),
  useInsurerUpdate: () => idle,
  useInsurerUploadLogo: () => idle,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe("InsurerDialog — CNPJ", () => {
  it("aceita CNPJ alfanumérico", async () => {
    const user = userEvent.setup()
    render(<InsurerDialog open onOpenChange={vi.fn()} editing={null} />)
    const input = screen.getByPlaceholderText("00.000.000/0000-00")
    await user.type(input, "12abc34501de35")
    expect(input).toHaveValue("12.ABC.345/01DE-35")

    await user.type(screen.getByPlaceholderText(/Ex: Porto Seguro Companhia/), "Seguradora Nova")
    await user.click(screen.getByRole("button", { name: "Criar Seguradora" }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0]).toEqual([expect.objectContaining({ cnpj: "12.ABC.345/01DE-35" })])
  })

  it("CNPJ numérico continua com a máscara de sempre", async () => {
    const user = userEvent.setup()
    render(<InsurerDialog open onOpenChange={vi.fn()} editing={null} />)
    const input = screen.getByPlaceholderText("00.000.000/0000-00")
    await user.type(input, "11222333000181")
    expect(input).toHaveValue("11.222.333/0001-81")
  })
})
