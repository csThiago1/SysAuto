/**
 * Paddock Solutions — Auth Helpers
 * Hooks e utilitários de autenticação/autorização
 */

"use client";

import { useSession } from "next-auth/react";
import type { PaddockRole } from "@paddock/types";

export type { MeResponse, MeEmployeeSnapshot, MeCustomerSnapshot } from "@paddock/types";

/**
 * Retorna dados de acesso multi-empresa do usuário autenticado.
 * Lê os claims diretamente da sessão next-auth v5 (companies, activeCompany,
 * tenantSchema, clientSlug) — propagados pelo callback session() em auth.ts.
 */
export function useCompanyAccess() {
  const { data: session } = useSession();

  const companies: string[] = session?.companies ?? [];
  const activeCompany: string = session?.activeCompany ?? "";
  const tenantSchema: string = session?.tenantSchema ?? "";
  const clientSlug: string = session?.clientSlug ?? "";
  const role: PaddockRole = session?.role ?? "STOREKEEPER";

  return {
    /** Verifica se o usuário tem acesso à empresa especificada */
    hasAccess: (company: string): boolean => companies.includes(company),

    /** Usuário pertence a mais de uma empresa */
    isMultiCompany: companies.length > 1,

    /** Empresa atualmente ativa */
    activeCompany,

    /** Role do usuário */
    role,

    /** Pode gerenciar OS e equipe (MANAGER, ADMIN, OWNER) */
    canManage: (["OWNER", "ADMIN", "MANAGER"] as PaddockRole[]).includes(role),

    /** Pode administrar o sistema (ADMIN, OWNER) */
    canAdmin: (["OWNER", "ADMIN"] as PaddockRole[]).includes(role),

    /** Pode acessar módulo de estoque (STOREKEEPER, MANAGER, ADMIN, OWNER) */
    canAccessInventory: (
      ["OWNER", "ADMIN", "MANAGER", "STOREKEEPER"] as PaddockRole[]
    ).includes(role),

    /** Tenant schema ativo (ex: "tenant_dscar") */
    tenantSchema,

    /** Client slug (ex: "grupo-dscar") */
    clientSlug,
  };
}

/** Verifica papel mínimo de acesso */
export function hasMinRole(
  userRole: PaddockRole,
  minRole: PaddockRole
): boolean {
  const hierarchy: PaddockRole[] = [
    "STOREKEEPER",
    "CONSULTANT",
    "MANAGER",
    "ADMIN",
    "OWNER",
  ];
  return hierarchy.indexOf(userRole) >= hierarchy.indexOf(minRole);
}
