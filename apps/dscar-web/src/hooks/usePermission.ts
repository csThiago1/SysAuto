import { useSession } from "next-auth/react";
import { ROLE_HIERARCHY, type PaddockRole } from "@paddock/types";

/** Retorna true se o usuário logado tem role >= minRole na hierarquia */
export function usePermission(minRole: PaddockRole): boolean {
  const { data: session, status } = useSession();
  if (status !== "authenticated") return false;
  const userRole = session.role ?? "STOREKEEPER";
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

