import { describe, it, expect } from "vitest"
import { SIGNATURE_CODE_MAP, getSignatureCodeConfig } from "../signatureCodeMap"

describe("signatureCodeMap", () => {
  it("mapeia SIGNATURE_APPROVAL para BUDGET_APPROVAL", () => {
    const cfg = getSignatureCodeConfig("SIGNATURE_APPROVAL")
    expect(cfg).toEqual({
      documentType: "BUDGET_APPROVAL",
      label: "Aprovação do orçamento",
    })
  })

  it("mapeia CLIENT_SIGNATURE para OS_DELIVERY", () => {
    const cfg = getSignatureCodeConfig("CLIENT_SIGNATURE")
    expect(cfg).toEqual({
      documentType: "OS_DELIVERY",
      label: "Entrega do veículo",
    })
  })

  it("retorna null para code desconhecido", () => {
    expect(getSignatureCodeConfig("BOGUS_CODE")).toBeNull()
  })

  it("SIGNATURE_CODE_MAP cobre os 2 codes do validator atual", () => {
    expect(Object.keys(SIGNATURE_CODE_MAP).sort()).toEqual(
      ["CLIENT_SIGNATURE", "SIGNATURE_APPROVAL"],
    )
  })
})
