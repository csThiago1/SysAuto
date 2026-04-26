/**
 * useExperts — CRUD hooks for Especialistas / Peritos
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { Expert } from "@paddock/types"

// ─── Helper: extrai .results de envelope DRF paginado ─────────────────────────

type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null }

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<Paginated<T> | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

const expertsKeys = {
  all: ["experts"] as const,
  list: (params: object) => ["experts", "list", params] as const,
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useExperts(params?: { search?: string }) {
  const query = new URLSearchParams()
  if (params?.search) query.set("search", params.search)
  return useQuery({
    queryKey: expertsKeys.list(params ?? {}),
    queryFn: () => fetchList<Expert>(`/api/proxy/experts/?${query.toString()}`),
  })
}

export function useCreateExpert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; email: string; phone: string; is_active: boolean }) =>
      apiFetch<Expert>("/api/proxy/experts/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expertsKeys.all }),
  })
}

export function useUpdateExpert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Expert> }) =>
      apiFetch<Expert>(`/api/proxy/experts/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: expertsKeys.all }),
  })
}
