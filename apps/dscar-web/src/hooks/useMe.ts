/**
 * Hook useMe — busca a identidade completa do usuário autenticado.
 *
 * Chama GET /api/v1/auth/me/ e retorna GlobalUser + perfis Employee/Customer.
 * Cache de 5 minutos — não revalidar em cada render.
 */
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import type { MeResponse } from "@paddock/types";

/** Query key centralizada para /me — usada para invalidar após login/logout. */
export const meKeys = {
  me: () => ["auth", "me"] as const,
};

/**
 * Busca a identidade completa do usuário autenticado.
 *
 * @returns TanStack Query result com MeResponse | undefined
 *
 * @example
 * ```tsx
 * const { data: me } = useMe();
 * if (me?.is_employee) console.log("Colaborador:", me.employee?.department);
 * ```
 */
export function useMe() {
  return useQuery({
    queryKey: meKeys.me(),
    queryFn: () => apiFetch<MeResponse>("/api/proxy/auth/me/"),
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: 1,
  });
}
