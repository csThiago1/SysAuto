import { describe, expect, it } from "vitest"
import { isValidCNPJ } from "@paddock/utils"

describe("isValidCNPJ", () => {
  it("aceita CNPJ alfanumérico com e sem máscara", () => {
    expect(isValidCNPJ("12.ABC.345/01DE-35")).toBe(true)
    expect(isValidCNPJ("12ABC34501DE35")).toBe(true)
  })

  it("recusa dígito verificador errado", () => {
    expect(isValidCNPJ("12ABC34501DE36")).toBe(false)
  })

  it("continua aceitando CNPJ numérico", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true)
    expect(isValidCNPJ("11.222.333/0001-82")).toBe(false)
  })

  it("recusa tamanho errado e sequência repetida", () => {
    expect(isValidCNPJ("1122233300018")).toBe(false)
    expect(isValidCNPJ("00.000.000/0000-00")).toBe(false)
    expect(isValidCNPJ("AAAAAAAAAAAAAA")).toBe(false)
  })
})
