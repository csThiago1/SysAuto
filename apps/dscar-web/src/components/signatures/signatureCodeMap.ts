import type { SignatureDocumentType } from "./types"

export interface SignatureCodeConfig {
  documentType: SignatureDocumentType
  label: string
}

export const SIGNATURE_CODE_MAP: Record<string, SignatureCodeConfig> = {
  SIGNATURE_APPROVAL: {
    documentType: "BUDGET_APPROVAL",
    label: "Aprovação do orçamento",
  },
  CLIENT_SIGNATURE: {
    documentType: "OS_DELIVERY",
    label: "Entrega do veículo",
  },
  // Futuros (descomentar quando o validator adicionar):
  // SIGNATURE_OPENING:    { documentType: "OS_OPEN",              label: "Abertura/recepção" },
  // SIGNATURE_INSURANCE:  { documentType: "INSURANCE_ACCEPTANCE", label: "Aceite da seguradora" },
  // SIGNATURE_COMPLEMENT: { documentType: "COMPLEMENT_APPROVAL",  label: "Aprovação de complemento" },
  // SIGNATURE_INSPECTION: { documentType: "VISTORIA_ENTRADA",     label: "Vistoria de entrada" },
}

export function getSignatureCodeConfig(code: string): SignatureCodeConfig | null {
  return SIGNATURE_CODE_MAP[code] ?? null
}
