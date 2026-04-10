/**
 * @paddock/types — Person (Cadastros)
 * Entidade unificada: Cliente, Seguradora, Corretor, Funcionário, Fornecedor.
 */

export type PersonRole =
  | "CLIENT"
  | "INSURER"
  | "BROKER"
  | "EMPLOYEE"
  | "SUPPLIER";

export type PersonKind = "PF" | "PJ";

export type ContactType =
  | "CELULAR"
  | "COMERCIAL"
  | "WHATSAPP"
  | "EMAIL"
  | "EMAIL_NFE"
  | "EMAIL_FINANCEIRO"
  | "SITE";

export type AddressType = "PRINCIPAL" | "COBRANCA" | "ENTREGA";

export type PersonJobTitle =
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

export type PersonDepartment =
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

export type Gender = "M" | "F" | "N";

export type InscriptionType =
  | "CONTRIBUINTE"
  | "NAO_CONTRIBUINTE"
  | "ISENTO";

// ─── Sub-entidades ────────────────────────────────────────────────────────────

export interface PersonRoleEntry {
  id: number;
  role: PersonRole;
}

export interface PersonContact {
  id?: number;
  contact_type: ContactType;
  value: string;
  label?: string;
  is_primary: boolean;
}

export interface PersonAddress {
  id?: number;
  address_type: AddressType;
  zip_code: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  is_primary: boolean;
}

export interface CepData {
  zip_code: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
}

// ─── Entidade principal ────────────────────────────────────────────────────────

export interface Person {
  id: number;
  person_kind: PersonKind;
  full_name: string;
  fantasy_name?: string;
  document?: string;
  secondary_document?: string;
  municipal_registration?: string;
  is_simples_nacional?: boolean;
  inscription_type?: InscriptionType;
  birth_date?: string;
  gender?: Gender;
  logo_url?: string;
  insurer_code?: string;
  /** Funcionário */
  job_title?: PersonJobTitle | "";
  job_title_display?: string;
  department?: PersonDepartment | "";
  department_display?: string;
  is_active: boolean;
  notes?: string;
  roles: PersonRoleEntry[];
  contacts: PersonContact[];
  addresses: PersonAddress[];
  /** Contato primário calculado pelo backend (somente-leitura) */
  primary_contact?: { type: ContactType; value: string } | null;
  created_at: string;
}

// ─── Payloads de escrita ───────────────────────────────────────────────────────

export interface CreatePersonPayload {
  person_kind: PersonKind;
  full_name: string;
  fantasy_name?: string;
  document?: string;
  secondary_document?: string;
  municipal_registration?: string;
  is_simples_nacional?: boolean;
  inscription_type?: InscriptionType;
  birth_date?: string;
  gender?: Gender;
  logo_url?: string;
  insurer_code?: string;
  /** Funcionário */
  job_title?: PersonJobTitle | "";
  department?: PersonDepartment | "";
  is_active?: boolean;
  notes?: string;
  roles: PersonRole[];
  contacts: Omit<PersonContact, "id">[];
  addresses: Omit<PersonAddress, "id">[];
}

export type UpdatePersonPayload = Partial<CreatePersonPayload>;
