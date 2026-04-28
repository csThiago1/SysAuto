/**
 * Paddock Solutions — @paddock/types
 * Document Generation System — TypeScript Types
 *
 * Types for OS reports, warranties, settlements, and receipt documents
 * with preview and download capabilities.
 */

export type DocumentType = "os_report" | "warranty" | "settlement" | "receipt"

export interface DocumentGeneration {
  id: string
  document_type: DocumentType
  document_type_display: string
  version: number
  service_order_id: string
  receivable_id: string | null
  s3_key: string
  file_size_bytes: number | null
  generated_by_name: string
  generated_at: string
  download_url: string
  created_at: string
}

export interface DocumentPreviewData {
  company: {
    razao_social: string
    cnpj_formatted: string
    ie: string
    endereco_linha: string
    telefone: string
    email: string
  }
  order: { number: number }
  customer: {
    name: string
    cpf: string
    cnpj: string
    rg: string
    phone: string
    email: string
    address: string
  }
  vehicle: {
    make: string
    model: string
    year: string
    color: string
    plate: string
    chassis: string
    mileage_in: number | null
  }
  services: DocumentServiceItem[]
  parts?: DocumentPartItem[]
  totals: {
    parts: string
    services: string
    discount: string
    grand_total: string
  }
  insurer?: {
    name: string
    casualty_number: string
    insured_type: string
    deductible_amount: string
  }
  payment?: {
    method: string
    method_display: string
    amount: string
    amount_words: string
    date: string
    status: string
  }
  receipt?: {
    description: string
    receivable_description: string
  }
  warranty_coverage?: string[]
  warranty_exclusions?: string[]
  observations: string
  location_date: string
}

export interface DocumentServiceItem {
  description: string
  quantity: string
  unit_price: string
  total: string
  category: string
  warranty_months?: number
  warranty_until?: string
}

export interface DocumentPartItem {
  description: string
  part_number: string
  quantity: string
  unit_price: string
  total: string
}

export interface GenerateDocumentPayload {
  document_type: DocumentType
  receivable_id?: string | null
  data: DocumentPreviewData
}

export const DOCUMENT_TYPE_CONFIG: Record<
  DocumentType,
  { label: string; icon: string }
> = {
  os_report: { label: "Ordem de Serviço", icon: "FileText" },
  warranty: { label: "Termo de Garantia", icon: "ShieldCheck" },
  settlement: { label: "Termo de Quitação", icon: "CheckCircle" },
  receipt: { label: "Recibo de Pagamento", icon: "Receipt" },
}
