/**
 * @paddock/types — HR (Recursos Humanos)
 * Sprint 7 — espelha models + serializers de apps.hr (Django)
 */

// ─── Choices ──────────────────────────────────────────────────────────────────

export type EmployeeStatus = "active" | "on_leave" | "vacation" | "terminated";

export type ContractType = "clt" | "pj" | "intern" | "temp" | "apprentice";

export type HRDepartment =
  | "reception"
  | "bodywork"
  | "painting"
  | "mechanical"
  | "aesthetics"
  | "polishing"
  | "washing"
  | "inventory"
  | "financial"
  | "administrative"
  | "management"
  | "direction";

export type HRPosition =
  | "receptionist"
  | "consultant"
  | "bodyworker"
  | "painter"
  | "mechanic"
  | "polisher"
  | "washer"
  | "storekeeper"
  | "manager"
  | "financial"
  | "administrative"
  | "director";

export type DocumentType =
  | "cnh"
  | "rg"
  | "birth_cert"
  | "marriage_cert"
  | "work_card"
  | "voter_id"
  | "military_cert"
  | "school_cert"
  | "medical_exam"
  | "contract"
  | "other";

export type BonusType =
  | "performance"
  | "goal"
  | "commission"
  | "gratification"
  | "profit_sharing"
  | "other";

export type GoalStatus =
  | "active"
  | "achieved"
  | "partially"
  | "missed"
  | "cancelled";

export type AllowanceType =
  | "meal"
  | "transport"
  | "health"
  | "education"
  | "fuel"
  | "housing"
  | "clothing"
  | "other";

export type AllowanceStatus = "requested" | "approved" | "paid" | "rejected";

export type DeductionType =
  | "inss"
  | "irrf"
  | "advance"
  | "absence"
  | "fgts"
  | "discount"
  | "other";

export type TimeClockEntryType =
  | "clock_in"
  | "break_start"
  | "break_end"
  | "clock_out";

export type TimeClockSource = "app" | "system" | "manual" | "biometric";

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface EmployeeUser {
  id: string;
  name: string;
  email_hash: string;
}

/** Returned by list endpoint — no sensitive fields */
export interface EmployeeListItem {
  id: string;
  user: EmployeeUser;
  registration_number: string;
  department: HRDepartment;
  department_display: string;
  position: HRPosition;
  position_display: string;
  status: EmployeeStatus;
  status_display: string;
  contract_type: ContractType;
  contract_type_display: string;
  hire_date: string;
  tenure_days: number;
}

/** Returned by detail/retrieve endpoint */
export interface Employee extends EmployeeListItem {
  termination_date: string | null;
  cpf_masked: string;
  rg_issuer: string;
  birth_date: string | null;
  marital_status: string;
  education_level: string;
  nationality: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  bank_account_type: "corrente" | "poupanca" | "";
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  /** Decimal as string (DRF default) */
  base_salary: string;
  pix_key_type: string;
  weekly_hours: string;
  work_schedule: string;
  pay_frequency: "monthly" | "biweekly" | "weekly";
  legacy_databox_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: DocumentType;
  document_type_display: string;
  file_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface SalaryHistory {
  id: string;
  employee: string;
  previous_salary: string;
  new_salary: string;
  effective_date: string;
  reason: string;
  authorized_by: string | null;
  authorized_by_name: string;
  created_at: string;
}

export interface Bonus {
  id: string;
  employee: string;
  bonus_type: BonusType;
  bonus_type_display: string;
  description: string;
  amount: string;
  reference_month: string;
  is_active: boolean;
  created_at: string;
}

export interface GoalTarget {
  id: string;
  employee: string | null;
  department: HRDepartment | null;
  title: string;
  description: string;
  target_value: string;
  current_value: string;
  unit: string;
  bonus_amount: string;
  start_date: string;
  end_date: string;
  status: GoalStatus;
  status_display: string;
  progress_pct: number;
  linked_bonus: string | null;
  is_recurring: boolean;
  recurrence_day: number;
  parent_goal: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Allowance {
  id: string;
  employee: string;
  allowance_type: AllowanceType;
  allowance_type_display: string;
  amount: string;
  reference_month: string;
  status: AllowanceStatus;
  status_display: string;
  approved_by: string | null;
  approved_by_name: string;
  approved_at: string | null;
  paid_at: string | null;
  receipt_file_key: string;
  notes: string;
  is_recurring: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Deduction {
  id: string;
  employee: string;
  deduction_type: DeductionType;
  deduction_type_display: string;
  description: string;
  discount_type: "fixed" | "percentage";
  amount: number | null;
  rate: number | null;
  reference_month: string;
  is_active: boolean;
  created_at: string;
}

export interface TimeClockEntry {
  id: string;
  employee: string;
  entry_type: TimeClockEntryType;
  entry_type_display: string;
  timestamp: string;
  source: TimeClockSource;
  source_display: string;
  ip_address: string;
  device_info: string;
  is_approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  justification: string;
  created_at: string;
}

export interface WorkSchedule {
  id: string;
  employee: string;
  weekday: number;
  weekday_display: string;
  start_time: string;
  break_start: string | null;
  break_end: string | null;
  end_time: string;
  is_day_off: boolean;
  effective_from: string;
  effective_until: string | null;
  created_at: string;
}

export interface Payslip {
  id: string;
  employee: string;
  employee_name: string;
  reference_month: string;
  base_salary: string;
  total_bonuses: string;
  total_allowances: string;
  total_overtime_hours: number;
  total_overtime_value: string;
  total_deductions: string;
  gross_pay: string;
  net_pay: string;
  worked_days: number;
  worked_hours: string;
  total_absences: number;
  total_late_minutes: number;
  bonus_breakdown: Record<string, unknown>;
  allowance_breakdown: Record<string, unknown>;
  deduction_breakdown: Record<string, unknown>;
  is_closed: boolean;
  closed_at: string | null;
  closed_by: string | null;
  pdf_file_key: string;
  notes: string;
  /** UUID do JournalEntry gerado pelo PayslipAccountingService ao fechar a folha. */
  journal_entry_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Time Clock Daily Summary ─────────────────────────────────────────────────

export interface DailySummaryEntry {
  id: string;
  type: TimeClockEntryType;
  timestamp: string;
  source: TimeClockSource;
}

export interface DailySummary {
  date: string;
  entries: DailySummaryEntry[];
  total_hours: number;
  total_minutes: number;
}

// ─── Write Payloads ───────────────────────────────────────────────────────────

export interface CreateEmployeePayload {
  /** Nome completo — cria ou localiza o GlobalUser */
  name: string;
  /** E-mail corporativo — chave de busca/criação do GlobalUser */
  email: string;
  department: HRDepartment;
  position: HRPosition;
  registration_number: string;
  contract_type: ContractType;
  hire_date: string;
  cpf?: string;
  rg?: string;
  birth_date?: string;
  marital_status?: string;
  education_level?: string;
  nationality?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  bank_name?: string;
  bank_agency?: string;
  bank_account?: string;
  bank_account_type?: "corrente" | "poupanca";
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  base_salary: number;
  pix_key?: string;
  pix_key_type?: string;
  weekly_hours?: number;
  work_schedule?: string;
  /** Default: "monthly" */
  pay_frequency?: "monthly" | "biweekly" | "weekly";
}

export type UpdateEmployeePayload = Partial<
  Omit<CreateEmployeePayload, "name" | "email" | "registration_number">
>;

export interface CreateSalaryHistoryPayload {
  previous_salary: number;
  new_salary: number;
  effective_date: string;
  reason?: string;
}

export interface RegisterClockPayload {
  employee: string;
  entry_type: TimeClockEntryType;
  source?: TimeClockSource;
  device_info?: string;
  justification?: string;
}

export interface CreateGoalPayload {
  employee?: string;
  department?: HRDepartment;
  title: string;
  description?: string;
  target_value: number;
  unit?: string;
  bonus_amount?: number;
  start_date: string;
  end_date: string;
  is_recurring?: boolean;
  recurrence_day?: number;
}

export interface CreateAllowancePayload {
  employee?: string;
  allowance_type: AllowanceType;
  amount: number;
  reference_month: string;
  notes?: string;
  is_recurring?: boolean;
}

export interface CreateBonusPayload {
  bonus_type: BonusType;
  description: string;
  amount: number;
  reference_month: string;
}

export interface CreateDeductionPayload {
  deduction_type: DeductionType;
  description: string;
  discount_type: "fixed" | "percentage";
  amount?: number;
  rate?: number;
  reference_month: string;
}

export interface GeneratePayslipPayload {
  employee: string;
  reference_month: string;
}

// ─── Display config (UI helpers) ──────────────────────────────────────────────

export const EMPLOYEE_STATUS_CONFIG: Record<
  EmployeeStatus,
  { label: string; variant: "default" | "warning" | "success" | "destructive" }
> = {
  active: { label: "Ativo", variant: "success" },
  on_leave: { label: "Afastado", variant: "warning" },
  vacation: { label: "Férias", variant: "default" },
  terminated: { label: "Desligado", variant: "destructive" },
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  clt: "CLT",
  pj: "PJ / Prestador",
  intern: "Estagiário",
  temp: "Temporário",
  apprentice: "Jovem Aprendiz",
};

export const DEPARTMENT_LABELS: Record<HRDepartment, string> = {
  reception: "Recepção",
  bodywork: "Funilaria",
  painting: "Pintura",
  mechanical: "Mecânica",
  aesthetics: "Estética",
  polishing: "Polimento",
  washing: "Lavagem",
  inventory: "Almoxarifado",
  financial: "Financeiro",
  administrative: "Administrativo",
  management: "Gerência",
  direction: "Diretoria",
};

export const GOAL_STATUS_CONFIG: Record<
  GoalStatus,
  { label: string; variant: "default" | "success" | "warning" | "destructive" }
> = {
  active: { label: "Em andamento", variant: "default" },
  achieved: { label: "Atingida", variant: "success" },
  partially: { label: "Parcialmente atingida", variant: "warning" },
  missed: { label: "Não atingida", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export const ALLOWANCE_STATUS_CONFIG: Record<
  AllowanceStatus,
  { label: string; variant: "default" | "success" | "warning" | "destructive" }
> = {
  requested: { label: "Solicitado", variant: "default" },
  approved: { label: "Aprovado", variant: "warning" },
  paid: { label: "Pago", variant: "success" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

export const ALLOWANCE_TYPE_LABELS: Record<AllowanceType, string> = {
  meal: "Vale Refeição",
  transport: "Vale Transporte",
  health: "Plano de Saúde",
  education: "Bolsa Educação",
  fuel: "Vale Combustível",
  housing: "Auxílio Moradia",
  clothing: "Uniforme / EPI",
  other: "Outro",
};

export const BONUS_TYPE_LABELS: Record<BonusType, string> = {
  performance: "Desempenho",
  goal: "Meta Atingida",
  commission: "Comissão",
  gratification: "Gratificação",
  profit_sharing: "PLR",
  other: "Outro",
};

export const DEDUCTION_TYPE_LABELS: Record<DeductionType, string> = {
  inss: "INSS",
  irrf: "IRRF",
  advance: "Adiantamento",
  absence: "Falta",
  fgts: "FGTS",
  discount: "Desconto",
  other: "Outro",
};

export const CLOCK_ENTRY_LABELS: Record<TimeClockEntryType, string> = {
  clock_in: "Entrada",
  break_start: "Início Intervalo",
  break_end: "Fim Intervalo",
  clock_out: "Saída",
};

export const POSITION_LABELS: Record<HRPosition, string> = {
  receptionist: "Recepcionista",
  consultant: "Consultor de Serviços",
  bodyworker: "Funileiro",
  painter: "Pintor",
  mechanic: "Mecânico",
  polisher: "Polidor",
  washer: "Lavador",
  storekeeper: "Almoxarife",
  manager: "Gerente",
  financial: "Financeiro",
  administrative: "Administrativo",
  director: "Diretor",
};
