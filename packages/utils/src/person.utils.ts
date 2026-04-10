/**
 * @paddock/utils — Person utilities
 * Labels, cores e helpers para entidades Person.
 * Sem import de hooks ou API — só funções puras sobre tipos.
 */

import type { PersonRole, ContactType, AddressType, PersonKind, PersonJobTitle, PersonDepartment } from "@paddock/types";

// ─── Labels ───────────────────────────────────────────────────────────────────

export const PERSON_ROLE_LABEL: Record<PersonRole, string> = {
  CLIENT:   "Cliente",
  INSURER:  "Seguradora",
  BROKER:   "Corretor",
  EMPLOYEE: "Funcionário",
  SUPPLIER: "Fornecedor",
} as const;

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  CELULAR:           "Celular",
  COMERCIAL:         "Comercial",
  WHATSAPP:          "WhatsApp",
  EMAIL:             "E-mail",
  EMAIL_NFE:         "E-mail NF-e",
  EMAIL_FINANCEIRO:  "E-mail Financeiro",
  SITE:              "Site",
} as const;

export const ADDRESS_TYPE_LABEL: Record<AddressType, string> = {
  PRINCIPAL: "Principal",
  COBRANCA:  "Cobrança",
  ENTREGA:   "Entrega",
} as const;

export const PERSON_KIND_LABEL: Record<PersonKind, string> = {
  PF: "Pessoa Física",
  PJ: "Pessoa Jurídica",
} as const;

// ─── Classes Tailwind por role ─────────────────────────────────────────────────

export const PERSON_ROLE_BADGE: Record<PersonRole, string> = {
  CLIENT:   "bg-primary/10 text-primary border-primary/20",
  INSURER:  "bg-amber-100 text-amber-700 border-amber-200",
  BROKER:   "bg-orange-100 text-orange-700 border-orange-200",
  EMPLOYEE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SUPPLIER: "bg-slate-100 text-slate-600 border-slate-200",
} as const;

// ─── Choices de Funcionário ───────────────────────────────────────────────────

export const PERSON_JOB_TITLE_LABEL: Record<PersonJobTitle, string> = {
  receptionist:   "Recepcionista",
  consultant:     "Consultor de Serviços",
  bodyworker:     "Funileiro",
  painter:        "Pintor",
  mechanic:       "Mecânico",
  polisher:       "Polidor",
  washer:         "Lavador",
  storekeeper:    "Almoxarife",
  manager:        "Gerente",
  financial:      "Financeiro",
  administrative: "Administrativo",
  director:       "Diretor",
} as const;

export const PERSON_JOB_TITLE_OPTIONS = Object.entries(PERSON_JOB_TITLE_LABEL).map(
  ([value, label]) => ({ value: value as PersonJobTitle, label })
);

export const PERSON_DEPARTMENT_LABEL: Record<PersonDepartment, string> = {
  reception:      "Recepção",
  bodywork:       "Funilaria",
  painting:       "Pintura",
  mechanical:     "Mecânica",
  aesthetics:     "Estética",
  polishing:      "Polimento",
  washing:        "Lavagem",
  inventory:      "Almoxarifado",
  financial:      "Financeiro",
  administrative: "Administrativo",
  management:     "Gerência",
  direction:      "Diretoria",
} as const;

export const PERSON_DEPARTMENT_OPTIONS = Object.entries(PERSON_DEPARTMENT_LABEL).map(
  ([value, label]) => ({ value: value as PersonDepartment, label })
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Label do documento de acordo com o tipo de pessoa */
export function documentLabel(kind: PersonKind): string {
  return kind === "PJ" ? "CNPJ" : "CPF";
}

/** Label do nome de acordo com o tipo de pessoa */
export function nameLabel(kind: PersonKind): string {
  return kind === "PJ" ? "Razão Social" : "Nome Completo";
}
