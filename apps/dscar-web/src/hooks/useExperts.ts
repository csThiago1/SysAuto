/**
 * useExperts — CRUD hooks for Especialistas / Peritos.
 * CRUD genérico via @/lib/crud-mutations.
 */
import { useQuery } from "@tanstack/react-query"
import type { Expert } from "@paddock/types"

import { fetchList } from "@/lib/api"
import { useCreate, useUpdate } from "@/lib/crud-mutations"

const expertsKeys = {
  all: ["experts"] as const,
  list: (params: object) => ["experts", "list", params] as const,
}

export function useExperts(params?: { search?: string }) {
  const query = new URLSearchParams()
  if (params?.search) query.set("search", params.search)
  return useQuery({
    queryKey: expertsKeys.list(params ?? {}),
    queryFn: () => fetchList<Expert>(`/api/proxy/experts/?${query.toString()}`),
  })
}

type ExpertPayload = { name: string; email: string; phone: string; is_active: boolean }

export const useCreateExpert = () => useCreate<Expert, ExpertPayload>("experts")
export const useUpdateExpert = () => useUpdate<Expert, Partial<Expert>>("experts")
