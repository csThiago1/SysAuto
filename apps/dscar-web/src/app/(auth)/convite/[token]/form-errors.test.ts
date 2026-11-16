import { describe, it, expect } from "vitest"
import { toFormErrors } from "./form-errors"

describe("toFormErrors", () => {
  it("mapeia erros dos campos que a tela mostra", () => {
    expect(toFormErrors({ email: ["Já existe uma conta com este e-mail."], cpf: "CPF inválido." })).toEqual({
      email: "Já existe uma conta com este e-mail.",
      cpf: "CPF inválido.",
    })
  })

  it("erro em campo que a tela não mostra vira mensagem geral", () => {
    const out = toFormErrors({ registration_number: ["já existe"] })
    expect(out.detail).toBe("Não foi possível concluir o cadastro. Tente novamente.")
  })

  it("usa o detail do backend quando vem", () => {
    expect(toFormErrors({ detail: "Não foi possível enviar a CNH." })).toEqual({ detail: "Não foi possível enviar a CNH." })
  })

  it("corpo inválido vira mensagem geral", () => {
    expect(toFormErrors("x").detail).toBeTruthy()
  })
})
