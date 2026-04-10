/**
 * @paddock/types — Módulo Financeiro (Contas a Pagar / Contas a Receber)
 * Sprint 14
 */

// ── Shared enums ─────────────────────────────────────────────────────────────

export type PaymentMethod =
  | "bank_transfer"
  | "pix"
  | "boleto"
  | "check"
  | "cash"
  | "credit_card"
  | "debit_card";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Transferência Bancária",
  pix: "PIX",
  boleto: "Boleto",
  check: "Cheque",
  cash: "Dinheiro",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
};

// ── Accounts Payable ──────────────────────────────────────────────────────────

export type PayableOrigin = "MAN" | "FOLHA" | "NFE_E" | "AUTO";
export type PayableStatus = "open" | "partial" | "paid" | "overdue" | "cancelled";

export const PAYABLE_ORIGIN_LABELS: Record<PayableOrigin, string> = {
  MAN: "Manual",
  FOLHA: "Folha de Pagamento",
  NFE_E: "NF-e de Entrada",
  AUTO: "Automático",
};

export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  open: "Em Aberto",
  partial: "Parcialmente Pago",
  paid: "Pago",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

export const PAYABLE_STATUS_COLOR: Record<PayableStatus, string> = {
  open: "bg-blue-100 text-blue-700 border-blue-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  paid: "bg-success-100 text-success-700 border-success-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

export interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  cpf: string;
  email: string;
  phone: string;
  contact_name: string;
  notes: string;
  is_active: boolean;
}

export interface PayablePayment {
  id: string;
  payment_date: string;
  amount: string;
  payment_method: PaymentMethod;
  bank_account: string;
  notes: string;
  journal_entry_id: string | null;
  created_at: string;
}

export interface PayableDocument {
  id: string;
  supplier: Supplier;
  supplier_name: string;
  description: string;
  document_number: string;
  document_date: string | null;
  amount: string;
  amount_paid: string;
  amount_remaining: string;
  due_date: string;
  competence_date: string;
  status: PayableStatus;
  origin: PayableOrigin;
  cost_center: string | null;
  notes: string;
  cancelled_at: string | null;
  cancel_reason: string;
  payments: PayablePayment[];
  created_at: string;
  updated_at: string;
}

export interface PayableDocumentListItem {
  id: string;
  supplier_name: string;
  description: string;
  document_number: string;
  due_date: string;
  amount: string;
  amount_paid: string;
  amount_remaining: string;
  status: PayableStatus;
  origin: PayableOrigin;
  created_at: string;
}

export interface CreatePayableDocumentPayload {
  supplier_id: string;
  description: string;
  amount: string;
  due_date: string;
  competence_date: string;
  document_number?: string;
  origin?: PayableOrigin;
  cost_center_id?: string | null;
  notes?: string;
}

export interface RecordPaymentPayload {
  payment_date: string;
  amount: string;
  payment_method: PaymentMethod;
  bank_account?: string;
  notes?: string;
}

// ── Accounts Receivable ───────────────────────────────────────────────────────

export type ReceivableOrigin = "MAN" | "OS" | "NFE" | "NFCE" | "NFSE";
export type ReceivableStatus = "open" | "partial" | "received" | "overdue" | "cancelled";

export const RECEIVABLE_ORIGIN_LABELS: Record<ReceivableOrigin, string> = {
  MAN: "Manual",
  OS: "Ordem de Serviço",
  NFE: "NF-e Emitida",
  NFCE: "NFC-e Emitida",
  NFSE: "NFS-e Emitida",
};

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  open: "Em Aberto",
  partial: "Parcialmente Recebido",
  received: "Recebido",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

export const RECEIVABLE_STATUS_COLOR: Record<ReceivableStatus, string> = {
  open: "bg-blue-100 text-blue-700 border-blue-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  received: "bg-success-100 text-success-700 border-success-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

export interface ReceivableReceipt {
  id: string;
  receipt_date: string;
  amount: string;
  payment_method: PaymentMethod;
  bank_account: string;
  notes: string;
  journal_entry_id: string | null;
  created_at: string;
}

export interface ReceivableDocument {
  id: string;
  customer_id: string;
  customer_name: string;
  description: string;
  document_number: string;
  document_date: string | null;
  amount: string;
  amount_received: string;
  amount_remaining: string;
  due_date: string;
  competence_date: string;
  status: ReceivableStatus;
  origin: ReceivableOrigin;
  service_order_id: string | null;
  cost_center: string | null;
  notes: string;
  cancelled_at: string | null;
  cancel_reason: string;
  receipts: ReceivableReceipt[];
  created_at: string;
  updated_at: string;
}

export interface ReceivableDocumentListItem {
  id: string;
  customer_name: string;
  description: string;
  document_number: string;
  due_date: string;
  amount: string;
  amount_received: string;
  amount_remaining: string;
  status: ReceivableStatus;
  origin: ReceivableOrigin;
  service_order_id: string | null;
  created_at: string;
}

export interface CreateReceivablePayload {
  customer_id: string;
  customer_name: string;
  description: string;
  amount: string;
  due_date: string;
  competence_date: string;
  origin?: ReceivableOrigin;
  service_order_id?: string | null;
  document_number?: string;
  notes?: string;
}

export interface RecordReceiptPayload {
  receipt_date: string;
  amount: string;
  payment_method: PaymentMethod;
  bank_account?: string;
  notes?: string;
}
