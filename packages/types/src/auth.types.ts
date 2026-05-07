/**
 * @paddock/types — Auth & RBAC
 * Fonte da verdade para roles e JWT. Não redefina em hooks ou componentes.
 */

export type PaddockRole =
  | "OWNER"        // Fundador — acesso total irrestrito
  | "ADMIN"        // Administrador da empresa
  | "MANAGER"      // Gerente operacional
  | "CONSULTANT"   // Consultor de atendimento (abre e acompanha OS)
  | "STOREKEEPER"; // Almoxarife (gestão de estoque de peças)

export const ROLE_HIERARCHY: Record<PaddockRole, number> = {
  OWNER:       5,
  ADMIN:       4,
  MANAGER:     3,
  CONSULTANT:  2,
  STOREKEEPER: 1,
} as const;

export const ROLE_LABEL: Record<PaddockRole, string> = {
  OWNER:       "Proprietário",
  ADMIN:       "Administrador",
  MANAGER:     "Gerente",
  CONSULTANT:  "Consultor",
  STOREKEEPER: "Almoxarife",
} as const;

/** Permissões granulares atribuídas individualmente ao colaborador. */
export type ExtraPermission =
  | "can_close_os"
  | "can_approve_budget"
  | "can_approve_purchase"
  | "can_view_financial"
  | "can_approve_allowance"
  | "can_manage_employees"
  | "can_generate_payroll"
  | "can_adjust_inventory";

export const EXTRA_PERMISSION_LABELS: Record<ExtraPermission, string> = {
  can_close_os:          "Fechar/entregar OS",
  can_approve_budget:    "Aprovar orçamento",
  can_approve_purchase:  "Aprovar pedido de compra",
  can_view_financial:    "Ver dados financeiros",
  can_approve_allowance: "Aprovar vales",
  can_manage_employees:  "Admitir/demitir colaboradores",
  can_generate_payroll:  "Gerar/fechar folha",
  can_adjust_inventory:  "Ajustar estoque manualmente",
} as const;

/** Verifica se role ou permissões permitem acesso. */
export function hasPermission(
  role: PaddockRole,
  perms: ExtraPermission[],
  required: ExtraPermission,
): boolean {
  if ((ROLE_HIERARCHY[role] ?? 0) >= ROLE_HIERARCHY.MANAGER) return true;
  return perms.includes(required);
}

export type JobTitle =
  | "reception"
  | "painting"
  | "mechanical"
  | "admin"
  | "inventory"
  | "sales"
  | "purchasing";

export interface StaffUser {
  id: string;
  name: string;
  job_title: JobTitle | "";
  job_title_display: string;
}

export interface PaddockJWT {
  sub: string;            // UUID global do usuário
  email: string;
  name: string;
  companies: string[];    // ["dscar", "pecas"]
  active_company: string; // empresa ativa na sessão
  role: PaddockRole;
  extra_permissions: ExtraPermission[];
  tenant_schema: string;  // "tenant_dscar"
  client_slug: string;    // "grupo-dscar"
  iat: number;
  exp: number;
}

// ─── /api/v1/auth/me/ ────────────────────────────────────────────────────────

/**
 * Resposta do endpoint GET /api/v1/auth/me/
 * Contém identidade completa do usuário autenticado:
 * GlobalUser + snapshot Employee (se colaborador) + snapshot Customer (se cliente).
 */

export interface MeEmployeeSnapshot {
  id: string;
  department: string;
  position: string;
  status: string;
  registration_number: string;
}

export interface MeCustomerSnapshot {
  id: string;
  name: string;
  phone_masked: string;
  cpf_masked: string;
}

export interface MeResponse {
  id: string;
  name: string;
  email_hash: string;
  role: PaddockRole;
  extra_permissions: ExtraPermission[];
  active_company: string;
  tenant_schema: string;
  is_employee: boolean;
  is_customer: boolean;
  employee: MeEmployeeSnapshot | null;
  customer: MeCustomerSnapshot | null;
}
