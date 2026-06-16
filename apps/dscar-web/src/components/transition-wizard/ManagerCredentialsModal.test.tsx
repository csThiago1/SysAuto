import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { ManagerCredentialsModal } from "./ManagerCredentialsModal"

function baseProps(overrides: Partial<React.ComponentProps<typeof ManagerCredentialsModal>> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    email: "",
    onEmailChange: vi.fn(),
    password: "",
    onPasswordChange: vi.fn(),
    isAuthorizing: false,
    onAuthorize: vi.fn(),
    ...overrides,
  }
}

describe("ManagerCredentialsModal", () => {
  it("não renderiza nada quando open=false", () => {
    render(<ManagerCredentialsModal {...baseProps({ open: false })} />)
    expect(screen.queryByText(/Credenciais do Gerente/i)).not.toBeInTheDocument()
  })

  it("mostra título e descrição", () => {
    render(<ManagerCredentialsModal {...baseProps()} />)
    expect(screen.getByText(/Credenciais do Gerente/i)).toBeInTheDocument()
    expect(screen.getByText(/gerente deve digitar/i)).toBeInTheDocument()
  })

  it("chama onEmailChange ao digitar no input de email", async () => {
    const user = userEvent.setup()
    const onEmailChange = vi.fn()
    render(<ManagerCredentialsModal {...baseProps({ onEmailChange })} />)
    await user.type(screen.getByLabelText(/email/i), "g@dscar.com")
    expect(onEmailChange).toHaveBeenCalled()
  })

  it("chama onPasswordChange ao digitar no input de senha", async () => {
    const user = userEvent.setup()
    const onPasswordChange = vi.fn()
    render(<ManagerCredentialsModal {...baseProps({ onPasswordChange })} />)
    await user.type(screen.getByLabelText(/senha/i), "x")
    expect(onPasswordChange).toHaveBeenCalled()
  })

  it("desabilita 'Autorizar' quando email vazio", () => {
    render(<ManagerCredentialsModal {...baseProps({ email: "", password: "x" })} />)
    expect(screen.getByRole("button", { name: /autorizar/i })).toBeDisabled()
  })

  it("desabilita 'Autorizar' quando senha vazia", () => {
    render(<ManagerCredentialsModal {...baseProps({ email: "g@d.com", password: "" })} />)
    expect(screen.getByRole("button", { name: /autorizar/i })).toBeDisabled()
  })

  it("habilita 'Autorizar' quando email e senha preenchidos", () => {
    render(<ManagerCredentialsModal {...baseProps({ email: "g@d.com", password: "x" })} />)
    expect(screen.getByRole("button", { name: /autorizar/i })).not.toBeDisabled()
  })

  it("chama onAuthorize ao clicar em 'Autorizar'", async () => {
    const user = userEvent.setup()
    const onAuthorize = vi.fn()
    render(<ManagerCredentialsModal {...baseProps({ email: "g@d.com", password: "x", onAuthorize })} />)
    await user.click(screen.getByRole("button", { name: /autorizar/i }))
    expect(onAuthorize).toHaveBeenCalledTimes(1)
  })

  it("chama onOpenChange(false) ao clicar em 'Cancelar'", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<ManagerCredentialsModal {...baseProps({ onOpenChange })} />)
    await user.click(screen.getByRole("button", { name: /cancelar/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("mostra spinner em 'Autorizar' quando isAuthorizing=true", () => {
    render(<ManagerCredentialsModal {...baseProps({ email: "g@d.com", password: "x", isAuthorizing: true })} />)
    const button = screen.getByRole("button", { name: /autorizar/i })
    expect(button).toBeDisabled()
    expect(button.querySelector(".animate-spin")).toBeInTheDocument()
  })
})
