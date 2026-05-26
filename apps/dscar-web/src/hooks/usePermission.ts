import { useSession } from "next-auth/react";
import { ROLE_HIERARCHY, type PaddockRole } from "@paddock/types";

/** Retorna true se o usuario logado tem role >= minRole na hierarquia */
export function usePermission(minRole: PaddockRole): boolean {
  const { data: session, status } = useSession();
  if (status !== "authenticated") return false;
  const userRole = session.role ?? "STOREKEEPER";
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

/** Check granular permission code from RBAC matrix */
export function useHasPermission(code: string): boolean {
  const { data: session, status } = useSession();
  if (status !== "authenticated") return false;
  const permissions: string[] = (session as Record<string, unknown>).permissions as string[] ?? [];
  return permissions.includes(code);
}

/** Get all permission codes for the current user */
export function usePermissions(): string[] {
  const { data: session, status } = useSession();
  if (status !== "authenticated") return [];
  return (session as Record<string, unknown>).permissions as string[] ?? [];
}

