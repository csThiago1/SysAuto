import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { InsurerTenantProfile, PaginatedResponse } from "@paddock/types"

import { apiFetch } from "@/lib/api"
import { useCreate, useDelete, useUpdate } from "@/lib/crud-mutations"
import type { ApiSchema } from "@/types"

// Insurer minimal (list) vs completo (detail) — nomes espelham o Django.
// Exportados pra callers usarem sem re-importar de @/types.
export type InsurerListItem = ApiSchema<"InsurerMinimal">
export type Insurer = ApiSchema<"Insurer">

const API = "/api/proxy/insurers"

const insurerKeys = {
  all: ["insurers"] as const,
  list: (search = "") => ["insurers", "list", search] as const,
  detail: (id: string) => ["insurers", "detail", id] as const,
  tenantProfile: (id: string) => ["insurers", "tenant-profile", id] as const,
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useInsurers(search = "") {
  const params = search ? `?search=${encodeURIComponent(search)}` : ""
  return useQuery<PaginatedResponse<InsurerListItem>>({
    queryKey: insurerKeys.list(search),
    queryFn: () =>
      apiFetch<PaginatedResponse<InsurerListItem>>(`${API}/${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

export function useInsurer(id: string) {
  return useQuery<Insurer>({
    queryKey: insurerKeys.detail(id),
    queryFn: () => apiFetch<Insurer>(`${API}/${id}/`),
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

export const useInsurerCreate = () => useCreate<Insurer, InsurerPayload>("insurers")
export const useInsurerUpdate = () => useUpdate<Insurer, Partial<InsurerPayload>>("insurers")
export const useInsurerDelete = () => useDelete("insurers")

export function useInsurerUploadLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData()
      formData.append("logo", file)
      return apiFetch<Insurer>(`${API}/${id}/upload_logo/`, {
        method: "POST",
        body: formData,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: insurerKeys.all }),
  })
}

export function useInsurerTenantProfile(insurerId: string | null) {
  return useQuery({
    queryKey: insurerKeys.tenantProfile(insurerId ?? ""),
    queryFn: () =>
      apiFetch<InsurerTenantProfile>(`${API}/${insurerId}/tenant_profile/`),
    enabled: !!insurerId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateInsurerTenantProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ insurerId, data }: { insurerId: string; data: Partial<InsurerTenantProfile> }) =>
      apiFetch<InsurerTenantProfile>(`${API}/${insurerId}/tenant_profile/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { insurerId }) => {
      void qc.invalidateQueries({ queryKey: insurerKeys.tenantProfile(insurerId) })
      toast.success("Perfil operacional atualizado.")
    },
    onError: () => toast.error("Erro ao salvar perfil."),
  })
}
