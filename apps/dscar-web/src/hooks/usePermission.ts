import { useSession } from "next-auth/react";
import type { PaddockRole } from "@paddock/types";

const HIERARCHY: Record<PaddockRole, number> = {
  OWNER:       5,
  ADMIN:       4,
  MANAGER:     3,
  CONSULTANT:  2,
  STOREKEEPER: 1,
};

/** Retorna true se o usuário logado tem role >= minRole na hierarquia */
export function usePermission(minRole: PaddockRole): boolean {
  const { data: session, status } = useSession();
  if (status !== "authenticated") return false;
  const userRole = session.role ?? "STOREKEEPER";
  return (HIERARCHY[userRole] ?? 0) >= (HIERARCHY[minRole] ?? 0);
}
