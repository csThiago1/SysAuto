/**
 * @paddock/types — Person (Cadastros)
 * Entidade unificada: Cliente, Seguradora, Corretor, Funcionário, Fornecedor.
 */

export type PersonRole =
  | "CLIENT"
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
  municipio_ibge?: string;
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

export interface PersonDocument {
  id: number;
  doc_type: "CPF" | "CNPJ" | "RG" | "IE" | "IM" | "CNH";
  value_masked: string;
  is_primary: boolean;
  issued_by?: string;
  issued_at?: string | null;
  expires_at?: string | null;
}

export interface PersonDocumentWrite {
  doc_type: "CPF" | "CNPJ" | "RG" | "IE" | "IM" | "CNH";
  value: string;
  is_primary: boolean;
  issued_by?: string;
  issued_at?: string | null;
  expires_at?: string | null;
}

export interface ClientProfile {
  lgpd_consent_version: string;
  lgpd_consent_date: string | null;
  lgpd_consent_ip: string | null;
  group_sharing_consent: boolean;
}

export interface InsurerTenantProfile {
  contact_sinistro_nome: string;
  contact_sinistro_phone: string;
  contact_sinistro_email: string;
  contact_financeiro_nome: string;
  contact_financeiro_phone: string;
  contact_financeiro_email: string;
  contact_comercial_nome: string;
  contact_comercial_phone: string;
  contact_comercial_email: string;
  portal_url: string;
  sla_dias_uteis: number | null;
  observacoes_operacionais: string;
  updated_at: string;
}

// ─── Entidade principal ────────────────────────────────────────────────────────

export interface Person {
  id: number;
  person_kind: PersonKind;
  full_name: string;
  fantasy_name?: string;
  secondary_document?: string;
  municipal_registration?: string;
  is_simples_nacional?: boolean;
  inscription_type?: InscriptionType;
  birth_date?: string;
  gender?: Gender;
  is_active: boolean;
  notes?: string;
  roles: PersonRoleEntry[];
  contacts: PersonContact[];
  addresses: PersonAddress[];
  documents: PersonDocument[];
  client_profile: ClientProfile | null;
  /** Contato primário calculado pelo backend (somente-leitura) */
  primary_contact?: { type: ContactType; value: string } | null;
  created_at: string;
}

// ─── Payloads de escrita ───────────────────────────────────────────────────────

export interface CreatePersonPayload {
  person_kind: PersonKind;
  full_name: string;
  fantasy_name?: string;
  secondary_document?: string;
  municipal_registration?: string;
  is_simples_nacional?: boolean;
  inscription_type?: InscriptionType;
  birth_date?: string;
  gender?: Gender;
  is_active?: boolean;
  notes?: string;
  roles: PersonRole[];
  contacts: Omit<PersonContact, "id">[];
  addresses: Omit<PersonAddress, "id">[];
  documents?: PersonDocumentWrite[];
}

export type UpdatePersonPayload = Partial<CreatePersonPayload>;
