export type SignatureDocumentType =
  | "BUDGET_APPROVAL"
  | "OS_OPEN"
  | "OS_DELIVERY"
  | "COMPLEMENT_APPROVAL"
  | "INSURANCE_ACCEPTANCE"
  | "VISTORIA_ENTRADA"

export type SignatureMethod = "CANVAS_TABLET" | "REMOTE_LINK" | "SCAN_PDF"

export interface CapturePayload {
  service_order_id: number
  document_type: SignatureDocumentType
  signer_name: string
  signature_png_base64: string
  signer_cpf?: string
  notes?: string
}

export interface Signature {
  id: number
  document_type: SignatureDocumentType
  method: SignatureMethod
  signer_name: string
  signer_cpf: string | null
  signed_at: string
  signature_png_base64?: string
  signature_hash: string
}
