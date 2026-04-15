import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Insurer, InsurerFull, PaginatedResponse } from "@paddock/types"
import { apiFetch } from "@/lib/api"

const API = "/api/proxy/insurers"

const insurerKeys = {
  all: ["insurers"] as const,
  list: (search = "") => ["insurers", "list", search] as const,
  detail: (id: string) => ["insurers", "detail", id] as const,
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useInsurers(search = "") {
  const params = search ? `?search=${encodeURIComponent(search)}` : ""
  return useQuery<PaginatedResponse<Insurer>>({
    queryKey: insurerKeys.list(search),
    queryFn: () => apiFetch<PaginatedResponse<Insurer>>(`${API}/${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useInsurer(id: string) {
  return useQuery<InsurerFull>({
    queryKey: insurerKeys.detail(id),
    queryFn: () => apiFetch<InsurerFull>(`${API}/${id}/`),
    enabled: !!id,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface InsurerPayload {
  name: string
  trade_name?: string
  cnpj: string
  brand_color?: string
  abbreviation?: string
  logo_url?: string
  uses_cilia?: boolean
  is_active?: boolean
}

export function useInsurerCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: InsurerPayload) =>
      apiFetch<InsurerFull>(`${API}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: insurerKeys.all }),
  })
}

export function useInsurerUpdate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<InsurerPayload>) =>
      apiFetch<InsurerFull>(`${API}/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: insurerKeys.all }),
  })
}

export function useInsurerDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`${API}/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: insurerKeys.all }),
  })
}

export function useInsurerUploadLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData()
      formData.append("logo", file)
      return apiFetch<InsurerFull>(`${API}/${id}/upload_logo/`, {
        method: "POST",
        body: formData,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: insurerKeys.all }),
  })
}
