/**
 * @paddock/types — Módulo Financeiro (Contabilidade)
 * Sprint 11: ChartOfAccounts, FiscalPeriod, JournalEntry
 */

export type AccountType = "A" | "L" | "E" | "R" | "C" | "X" | "O";
export type NatureType = "D" | "C";
export type JournalEntryOrigin =
  | "MAN"
  | "OS"
  | "NFE"
  | "NFCE"
  | "NFSE"
  | "NFE_E"
  | "PAG"
  | "REC"
  | "ASAAS"
  | "OFX"
  | "FOLHA"
  | "DEP"
  | "ENC"
  | "EST";

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  nature: NatureType;
  is_analytical: boolean;
  level: number;
  accepts_cost_center: boolean;
  parent: string | null;
  sped_code: string;
  is_active: boolean;
}

export interface ChartOfAccountNode extends ChartOfAccount {
  children: ChartOfAccountNode[];
}

export interface FiscalYear {
  id: string;
  year: number;
  is_closed: boolean;
}

export interface FiscalPeriod {
  id: string;
  number: number;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  is_adjustment: boolean;
  fiscal_year: FiscalYear;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
}

export interface JournalEntryLine {
  id: string;
  account: ChartOfAccount;
  cost_center: CostCenter | null;
  debit_amount: string;
  credit_amount: string;
  description: string;
  document_number: string;
}

export interface JournalEntry {
  id: string;
  number: string;
  description: string;
  competence_date: string;
  document_date: string | null;
  origin: JournalEntryOrigin;
  is_approved: boolean;
  is_reversed: boolean;
  is_balanced: boolean;
  total_debit: string;
  total_credit: string;
  fiscal_period: string; // UUID — usar fiscal_period_label para exibição
  fiscal_period_label: string;
  lines: JournalEntryLine[];
  created_at: string;
  updated_at: string;
}

export interface JournalEntryListItem {
  id: string;
  number: string;
  description: string;
  competence_date: string;
  origin: JournalEntryOrigin;
  is_approved: boolean;
  is_reversed: boolean;
  total_debit: string;
  total_credit: string;
  fiscal_period: string; // UUID
  fiscal_period_label: string;
  created_at: string;
}

export interface CreateJournalEntryLinePayload {
  account_id: string;
  debit_amount: string;
  credit_amount: string;
  description?: string;
  cost_center_id?: string | null;
}

export interface CreateJournalEntryPayload {
  description: string;
  competence_date: string;
  origin: JournalEntryOrigin;
  lines: CreateJournalEntryLinePayload[];
}

export interface CreateChartOfAccountPayload {
  code: string;
  name: string;
  parent_code?: string;
  account_type: AccountType;
  nature: NatureType;
  is_analytical: boolean;
  accepts_cost_center: boolean;
  sped_code?: string;
}

export interface AccountBalanceResponse {
  account_id: string;
  balance: string;
  debit_total: string;
  credit_total: string;
}

// ── Display helpers ────────────────────────────────────────────────────────────

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  A: "Ativo",
  L: "Passivo",
  E: "Patrimônio Líquido",
  R: "Receita",
  C: "Custo",
  X: "Despesa",
  O: "Outros",
};

export const ACCOUNT_TYPE_COLOR: Record<AccountType, string> = {
  A: "bg-blue-100 text-blue-700 border-blue-200",
  L: "bg-orange-100 text-orange-700 border-orange-200",
  E: "bg-purple-100 text-purple-700 border-purple-200",
  R: "bg-success-100 text-success-700 border-success-200",
  C: "bg-red-100 text-red-700 border-red-200",
  X: "bg-red-100 text-red-700 border-red-200",
  O: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

export const NATURE_LABELS: Record<NatureType, string> = {
  D: "Devedora",
  C: "Credora",
};

export const ORIGIN_LABELS: Record<JournalEntryOrigin, string> = {
  MAN: "Manual",
  OS: "Ordem de Serviço",
  NFE: "NF-e Emitida",
  NFCE: "NFC-e Emitida",
  NFSE: "NFS-e Emitida",
  NFE_E: "NF-e Entrada",
  PAG: "Pagamento Bancário",
  REC: "Recebimento Bancário",
  ASAAS: "Asaas (Cobrança)",
  OFX: "Importação OFX",
  FOLHA: "Folha de Pagamento",
  DEP: "Depreciação",
  ENC: "Encerramento de Período",
  EST: "Ajuste de Estoque",
};
