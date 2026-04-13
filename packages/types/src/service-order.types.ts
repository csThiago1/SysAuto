/**
 * @paddock/types — Service Order (OS)
 * Espelha os models do backend service_orders/. Manter em sincronia.
 */

// ─── Enums de status e tipos ──────────────────────────────────────────────────

export type ServiceOrderStatus =
  | "reception"
  | "initial_survey"
  | "budget"
  | "waiting_auth"
  | "authorized"
  | "waiting_parts"
  | "repair"
  | "mechanic"
  | "bodywork"
  | "painting"
  | "assembly"
  | "polishing"
  | "washing"
  | "final_survey"
  | "ready"
  | "delivered"
  | "cancelled";

export type CustomerType    = "insurer" | "private";
export type OSType          = "bodywork" | "warranty" | "rework" | "mechanical" | "aesthetic";
export type InsuredType     = "insured" | "third";
export type VehicleLocation = "in_transit" | "workshop";
export type FuelType        = "flex" | "gasoline" | "ethanol" | "diesel" | "electric" | "hybrid" | string;

// ─── Pastas de fotos ───────────────────────────────────────────────────────────

export type OSPhotoFolder =
  | "vistoria_inicial"
  | "complemento"
  | "checklist_entrada"
  | "documentos"
  | "orcamentos"
  | "acompanhamento"
  | "vistoria_final";

// ─── Tipos de atividade do histórico ──────────────────────────────────────────

export type ActivityType =
  | "created"
  | "status_changed"
  | "updated"
  | "customer_updated"
  | "vehicle_updated"
  | "schedule_updated"
  | "insurer_updated"
  | "reminder"
  | "file_upload"
  | "note_added"
  | "budget_snapshot"
  | "cilia_import"
  | "delivery"
  | "part_added"
  | "part_removed"
  | "labor_added"
  | "labor_removed"
  | "invoice_issued";

// ─── Transições de estado (espelha backend VALID_TRANSITIONS) ─────────────────

/** ATENÇÃO: manter sincronizado com backend service_orders/models.py */
export const VALID_TRANSITIONS: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  reception:      ["initial_survey", "cancelled"],
  initial_survey: ["budget", "waiting_auth"],
  budget:         ["waiting_auth", "waiting_parts", "repair"],
  waiting_auth:   ["authorized", "cancelled"],
  authorized:     ["waiting_parts", "repair"],
  waiting_parts:  ["repair"],
  repair:         ["mechanic", "bodywork", "polishing"],
  mechanic:       ["bodywork", "polishing"],
  bodywork:       ["painting"],
  painting:       ["assembly"],
  assembly:       ["polishing"],
  polishing:      ["washing"],
  washing:        ["final_survey"],
  final_survey:   ["ready"],
  ready:          ["delivered"],
  delivered:      [],
  cancelled:      [],
} as const;

// ─── Sub-entidades ────────────────────────────────────────────────────────────

export interface StatusTransitionLog {
  id: string;
  from_status: ServiceOrderStatus;
  from_status_display: string;
  to_status: ServiceOrderStatus;
  to_status_display: string;
  triggered_by_field: string;
  changed_by_name: string;
  created_at: string;
}

export interface ServiceOrderPhoto {
  id: string;
  /** Pasta onde a foto está organizada */
  folder: OSPhotoFolder;
  /** Valor original do campo stage (legado) */
  original_stage: string;
  /** Legenda opcional da foto */
  caption: string;
  s3_key: string;
  url: string | null;
  uploaded_at: string;
  is_active: boolean;
}

export interface ServiceOrderPart {
  id: string;
  product: string | null;
  product_name: string | null;
  description: string;
  part_number: string;
  quantity: string;
  unit_price: string;
  discount: string;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderLabor {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
  total: number;
  created_at: string;
  updated_at: string;
}

// ─── Budget Snapshots ─────────────────────────────────────────────────────────

export type BudgetSnapshotTrigger = "cilia_import" | "manual_save" | "delivery" | "part_change";

export interface BudgetSnapshotItem {
  type: "part" | "labor";
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  part_number?: string;
  product_name?: string;
}

export interface BudgetSnapshot {
  id: string;
  version: number;
  trigger: BudgetSnapshotTrigger;
  trigger_display: string;
  parts_total: string;
  services_total: string;
  discount_total: string;
  grand_total: number;
  items_snapshot: BudgetSnapshotItem[];
  created_by_name: string;
  created_at: string;
}

// ─── Activity Log (Histórico enriquecido) ─────────────────────────────────────

export interface FieldChange {
  field: string;
  field_label: string;
  old_value: string | number | null;
  new_value: string | number | null;
}

export interface ActivityLog {
  id: string;
  activity_type: ActivityType;
  activity_type_display: string;
  description: string;
  metadata: {
    field_changes?: FieldChange[];
    snapshot_version?: number;
    from_status?: ServiceOrderStatus;
    to_status?: ServiceOrderStatus;
    folder?: OSPhotoFolder;
    file_count?: number;
    [key: string]: unknown;
  };
  user: string;
  user_name: string;
  created_at: string;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreatePartPayload {
  description: string;
  part_number?: string;
  product?: string | null;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export interface CreateLaborPayload {
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
}

export interface ServiceOrderPartPayload {
  description: string;
  part_number?: string;
  quantity: string;
  unit_price: string;
  discount?: string;
  product?: string | null;
}

export interface ServiceOrderLaborPayload {
  description: string;
  quantity: string;
  unit_price: string;
  discount?: string;
}

export interface DeliverOSPayload {
  mileage_out?: number;
  notes?: string;
  nfe_key?: string;
  nfse_number?: string;
}

export interface OverdueServiceOrder {
  id: string;
  number: number;
  plate: string;
  customer_name: string;
  status: ServiceOrderStatus;
  status_display: string;
  estimated_delivery_date: string;
  days_overdue: number;
  urgency: "overdue" | "due_today" | "upcoming";
}

// ─── Entidade principal ────────────────────────────────────────────────────────

export interface ServiceOrder {
  id: string;
  number: number;
  status: ServiceOrderStatus;
  status_display: string;
  allowed_transitions: ServiceOrderStatus[];

  // Tipo de OS
  customer_type: CustomerType | null;
  os_type: OSType | null;

  // Seguradora
  insurer: string | null;
  insurer_detail: import("./insurer.types").Insurer | null;
  insured_type: InsuredType | null;
  casualty_number: string;
  deductible_amount: string | null;
  broker_name: string;

  // Perito
  expert: string | null;
  expert_detail: import("./expert.types").Expert | null;
  expert_date: string | null;
  survey_date: string | null;
  authorization_date: string | null;

  // Particular
  quotation_date: string | null;

  // Cliente
  customer: string | null;        // FK inteiro (legado, ignorar)
  customer_uuid: string | null;   // UUID do UnifiedCustomer — usar este para lookup
  customer_name: string;

  // Veículo
  plate: string;
  make: string;
  model: string;
  vehicle_version: string;
  year: number | null;
  color: string;
  chassis: string;
  fuel_type: string;
  fipe_value: string | null;
  mileage_in: number | null;
  mileage_out: number | null;

  // Entrada e localização
  vehicle_location: VehicleLocation;
  entry_date: string | null;
  service_authorization_date: string | null;

  // Agendamento e prazo
  scheduling_date: string | null;
  repair_days: number | null;
  estimated_delivery_date: string | null;
  delivery_date: string | null;

  // Vistoria final e entrega
  final_survey_date: string | null;
  client_delivery_date: string | null;

  // Controle
  consultant: string | null;
  consultant_name: string;
  days_in_shop: number | null;
  transition_logs: StatusTransitionLog[];
  photos: ServiceOrderPhoto[];
  parts: ServiceOrderPart[];
  labor_items: ServiceOrderLabor[];

  // Financial
  total: number;
  parts_total: string;
  services_total: string;
  discount_total: string;
  notes: string;

  // Fiscal
  nfe_key: string;
  nfse_number: string;
  invoice_issued: boolean;

  opened_at: string;
  created_at: string;
  updated_at: string;
}
