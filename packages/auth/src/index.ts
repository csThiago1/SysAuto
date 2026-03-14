/**
 * Paddock Solutions — Auth Helpers
 * Hooks e utilitários de autenticação/autorização
 */

"use client";

import { useSession } from "next-auth/react";
import type { PaddockJWT, PaddockRole } from "@paddock/types";

export function useCompanyAccess() {
    const { data: session } = useSession();
    const token = session?.user as unknown as PaddockJWT;

    return {
        /** Verifica se o usuário tem acesso à empresa especificada */
        hasAccess: (company: string): boolean =>
            token?.companies?.includes(company) ?? false,

        /** Usuário pertence a mais de uma empresa */
        isMultiCompany: (token?.companies?.length ?? 0) > 1,

        /** Empresa atualmente ativa */
        activeCompany: token?.active_company ?? "",

        /** Role do usuário */
        role: token?.role ?? ("READONLY" as PaddockRole),

        /** Pode gerenciar (MANAGER, ADMIN, OWNER) */
        canManage: (["OWNER", "ADMIN", "MANAGER"] as PaddockRole[]).includes(
            token?.role
        ),

        /** Pode administrar (ADMIN, OWNER) */
        canAdmin: (["OWNER", "ADMIN"] as PaddockRole[]).includes(token?.role),

        /** Tenant schema ativo */
        tenantSchema: token?.tenant_schema ?? "",

        /** Client slug (ex: 'grupo-dscar') */
        clientSlug: token?.client_slug ?? "",
    };
}

/** Verifica papel mínimo de acesso */
export function hasMinRole(
    userRole: PaddockRole,
    minRole: PaddockRole
): boolean {
    const hierarchy: PaddockRole[] = [
        "READONLY",
        "SALESPERSON",
        "TECHNICIAN",
        "ACCOUNTANT",
        "CONSULTANT",
        "MANAGER",
        "ADMIN",
        "OWNER",
    ];
    return hierarchy.indexOf(userRole) >= hierarchy.indexOf(minRole);
}
