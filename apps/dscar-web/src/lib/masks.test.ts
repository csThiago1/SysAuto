import { describe, it, expect } from "vitest"
import {
  formatPhone, formatCPF, formatCNPJ, formatCpfCnpj, formatCEP,
  formatPlate, formatDateBR, onlyDigits, onlyAlnum,
} from "@paddock/utils"

describe("máscaras", () => {
  it("telefone celular e fixo", () => {
    expect(formatPhone("92991222222")).toBe("(92) 99122-2222")
    expect(formatPhone("9232122222")).toBe("(92) 3212-2222")
    expect(formatPhone("")).toBe("")
    expect(formatPhone("9")).toBe("(9")
  })

  it("CPF e CNPJ pelo comprimento", () => {
    expect(formatCPF("12345678900")).toBe("123.456.789-00")
    expect(formatCNPJ("12345678000190")).toBe("12.345.678/0001-90")
    expect(formatCpfCnpj("12345678900")).toBe("123.456.789-00")
    expect(formatCpfCnpj("12345678000190")).toBe("12.345.678/0001-90")
  })

  it("CEP, placa Mercosul e antiga, data", () => {
    expect(formatCEP("69050000")).toBe("69050-000")
    expect(formatPlate("PTY2E25")).toBe("PTY-2E25")
    expect(formatPlate("ABC1234")).toBe("ABC-1234")
    expect(formatDateBR("31122026")).toBe("31/12/2026")
  })

  it("ignora o que o usuário digitar além do tamanho", () => {
    expect(formatPhone("929912222229999")).toBe("(92) 99122-2222")
    expect(formatPlate("PTY2E25XYZ")).toBe("PTY-2E25")
  })

  /**
   * O que dispensa lógica de backspace: o separador só entra quando o próximo
   * caractere chega, então nenhuma saída termina em separador. Apagar sempre
   * muda a tela — sem isso, o backspace vira tecla morta em cima do "-" ou do
   * ") " e o campo trava.
   */
  it("nenhuma máscara termina em separador", () => {
    const fmts = [formatPhone, formatCPF, formatCNPJ, formatCEP, formatPlate, formatDateBR]
    const entrada = "PTY2E25ABC1234567890"
    for (const fmt of fmts) {
      for (let i = 1; i <= entrada.length; i++) {
        const saida = fmt(entrada.slice(0, i))
        expect(saida).not.toMatch(/[.\-/() ]$/)
      }
    }
  })

  it("o valor limpo é o que vai pra API", () => {
    expect(onlyDigits("(92) 99122-2222")).toBe("92991222222")
    expect(onlyAlnum("PTY-2E25")).toBe("PTY2E25")
  })
})
