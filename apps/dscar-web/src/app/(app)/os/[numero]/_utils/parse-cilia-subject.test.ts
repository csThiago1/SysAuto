import { describe, it, expect } from "vitest"
import { parseCiliaSubject } from "./parse-cilia-subject"

/**
 * Os casos abaixo são assuntos reais da caixa da DS Car — inclusive os
 * irregulares (sinistro com pontos, seguradora de nome curto).
 */
describe("parseCiliaSubject", () => {
  it("extrai sinistro, orçamento e versão do assunto", () => {
    expect(
      parseCiliaSubject(
        "Yelum Seguradora - Sin. 22575391 - Orç. 905433.2 - Conclusão: Autorizado",
      ),
    ).toEqual({
      casualtyNumber: "22575391",
      budgetNumber: "905433",
      versionNumber: "2",
      conclusion: "Autorizado",
    })
  })

  it("aceita sinistro longo do Bradesco", () => {
    const r = parseCiliaSubject(
      "Bradesco Seguros - Sin. 104202608041229 - Orç. 1941275.2 - Conclusão: Autorizado",
    )
    expect(r?.casualtyNumber).toBe("104202608041229")
    expect(r?.budgetNumber).toBe("1941275")
    expect(r?.versionNumber).toBe("2")
  })

  it("aceita sinistro com pontos", () => {
    const r = parseCiliaSubject(
      "A - Sin. 13147.26.2 - Orç. 267889.2 - Conclusão: Autorizado",
    )
    expect(r?.casualtyNumber).toBe("13147.26.2")
    expect(r?.budgetNumber).toBe("267889")
    expect(r?.versionNumber).toBe("2")
  })

  it("captura conclusão com acento e espaços", () => {
    const r = parseCiliaSubject(
      "Tokio Marine - Sin. 427777101 - Orç. 1571635.1 - Conclusão: Provável Indenização Integral",
    )
    expect(r?.conclusion).toBe("Provável Indenização Integral")
  })

  it("aceita o texto do corpo do e-mail com rótulos por extenso", () => {
    expect(
      parseCiliaSubject("Sinistro 22575391 - Número do Orçamento 905433.2"),
    ).toEqual({
      casualtyNumber: "22575391",
      budgetNumber: "905433",
      versionNumber: "2",
    })
  })

  it("aceita assunto sem sufixo de versão", () => {
    const r = parseCiliaSubject("YOUSE - Sin. 5003120047203 - Orç. 4446")
    expect(r?.budgetNumber).toBe("4446")
    expect(r?.versionNumber).toBeUndefined()
  })

  it("ignora espaços em volta", () => {
    expect(
      parseCiliaSubject("   Sin. 123 - Orç. 456.7   ")?.budgetNumber,
    ).toBe("456")
  })

  it("devolve null para texto que não é do Cilia", () => {
    for (const texto of ["", "   ", "Bom dia, segue orçamento em anexo", "Sin. 123"]) {
      expect(parseCiliaSubject(texto)).toBeNull()
    }
  })
})
