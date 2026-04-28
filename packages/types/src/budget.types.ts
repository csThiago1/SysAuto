/**
 * @paddock/types — Budget (Orçamentos Particulares)
 * Espelha apps.budgets do backend. Distinto de apps.quotes (Cilia/seguradora).
 */

export type BudgetVersionStatus =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "expired"
  | "revision"
  | "superseded"

export type BudgetItemType =
  | "PART"
  | "SERVICE"
  | "EXTERNAL_SERVICE"
  | "FEE"
  | "DISCOUNT"

export interface BudgetItemOperation {
  id: number
  operation_type: { id: number; code: string; label: string }
  labor_category: { id: number; code: string; label: string }
  hours: string
  hourly_rate: string
  labor_cost: string
}

export interface BudgetVersionItem {
  id: number
  bucket: string
  payer_block: string
  impact_area: number | null
  item_type: BudgetItemType
  description: string
  external_code: string
  part_type: string
  supplier: string
  quantity: string
  unit_price: string
  unit_cost: string | null
  discount_pct: string
  net_price: string
  sort_order: number
  flag_abaixo_padrao: boolean
  flag_acima_padrao: boolean
  flag_inclusao_manual: boolean
  flag_codigo_diferente: boolean
  flag_servico_manual: boolean
  flag_peca_da_conta: boolean
  operations: BudgetItemOperation[]
}

export interface BudgetVersion {
  id: number
  version_number: number
  status: BudgetVersionStatus
  status_display: string
  valid_until: string | null
  subtotal: string
  discount_total: string
  net_total: string
  labor_total: string
  parts_total: string
  pdf_s3_key: string
  sent_at: string | null
  approved_at: string | null
  approved_by: string
  created_by: string
  created_at: string
  items: BudgetVersionItem[]
}

export interface Budget {
  id: number
  number: string
  customer: number
  customer_name: string
  vehicle_plate: string
  vehicle_description: string
  vehicle_make_logo: string
  cloned_from: number | null
  service_order: number | null
  active_version: BudgetVersion | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Versão simplificada para listagem (active_version sem items) */
export interface BudgetListItem extends Omit<Budget, "active_version"> {
  active_version: Pick<
    BudgetVersion,
    "id" | "version_number" | "status" | "status_display" | "net_total"
  > | null
}

/** Payload para criar orçamento */
export interface BudgetCreatePayload {
  customer_id: number
  vehicle_plate: string
  vehicle_description: string
  vehicle_chassis?: string
  vehicle_version?: string
  vehicle_engine?: string
  vehicle_color?: string
  vehicle_fuel_type?: string
  vehicle_make_logo?: string
  vehicle_year?: number | null
}

/** Payload para aprovar versão */
export interface BudgetApprovePayload {
  approved_by: string
  evidence_s3_key?: string
}

/** Payload para criar item */
export interface BudgetItemCreatePayload {
  description: string
  item_type: BudgetItemType
  quantity: string
  unit_price: string
  net_price: string
  discount_pct?: string
  unit_cost?: string | null
  bucket?: string
  payer_block?: string
  part_type?: string
  supplier?: string
  sort_order?: number
  operations?: {
    operation_type_code: string
    labor_category_code: string
    hours: string
    hourly_rate: string
    labor_cost?: string
  }[]
}
