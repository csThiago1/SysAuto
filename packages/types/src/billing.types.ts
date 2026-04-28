/**
 * @paddock/types — Billing (Faturamento de OS)
 */

export type BillingRecipientType = "customer" | "insurer"
export type BillingCategory = "deductible" | "services" | "parts" | "full"

export type PaymentMethod =
  | "pix"
  | "cash"
  | "debit"
  | "credit"
  | "credit_installment"
  | "boleto"
  | "transfer"

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  debit: "Débito",
  credit: "Crédito à Vista",
  credit_installment: "Crédito a Prazo",
  boleto: "Boleto",
  transfer: "Transferência",
}

export const PAYMENT_TERMS = [
  { days: 0, label: "À vista" },
  { days: 7, label: "7 dias" },
  { days: 10, label: "10 dias" },
  { days: 15, label: "15 dias" },
  { days: 21, label: "21 dias" },
  { days: 30, label: "30 dias" },
  { days: 45, label: "45 dias" },
  { days: 60, label: "60 dias" },
] as const

export interface BillingPreviewItem {
  recipient_type: BillingRecipientType
  category: BillingCategory
  label: string
  amount: string
  default_payment_method: PaymentMethod
  default_payment_term_days: number
  note: string | null
}

export interface BillingPreview {
  parts_total: string
  services_total: string
  discount_total: string
  grand_total: string
  deductible_amount: string
  customer_type: string
  customer_name: string
  insurer_name: string
  items: BillingPreviewItem[]
  can_bill: boolean
}

export interface BillingItemPayload {
  recipient_type: BillingRecipientType
  category: BillingCategory
  amount: string
  payment_method: PaymentMethod
  payment_term_days: number
}

export interface BillingPayload {
  items: BillingItemPayload[]
}

export interface BillingSummary {
  total_billed: string
  receivables_count: number
  fiscal_docs_count: number
}

export interface BillingResult {
  receivables: unknown[]
  fiscal_documents: unknown[]
  summary: BillingSummary
}
