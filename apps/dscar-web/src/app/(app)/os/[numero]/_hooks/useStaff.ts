"use client"

import { useQuery } from "@tanstack/react-query"
import type { StaffUser } from "@paddock/types"
import { fetchList } from "@/lib/api"

/** Todos os usuários ativos */
export function useStaff() {
  return useQuery<StaffUser[]>({
    queryKey: ["staff"],
    queryFn: () => fetchList<StaffUser>("/api/proxy/auth/staff/"),
    staleTime: 5 * 60_000,
  })
}

/** Apenas consultores e gerentes (filtrados via Employee.position no HR) */
export function useConsultants() {
  return useQuery<StaffUser[]>({
    queryKey: ["staff", "consultants"],
    queryFn: () =>
      fetchList<StaffUser>(
        "/api/proxy/auth/staff/?positions=consultant,manager,director,owner"
      ),
    staleTime: 5 * 60_000,
  })
}
