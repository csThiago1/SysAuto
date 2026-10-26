import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { z } from "zod"
import type { InsurerTenantProfile, PaginatedResponse } from "@paddock/types"

import { apiFetch } from "@/lib/api"
import { useCreate, useUpdate } from "@/lib/crud-mutations"
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
  tomadores: (id: string) => ["insurers", "tomadores", id] as const,
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** `includeInactive` só tem efeito para ADMIN+ (o backend ignora para os outros). */
export function useInsurers(search = "", { includeInactive = false } = {}) {
  const params = new URLSearchParams({ page_size: "200" })
  if (search) params.set("search", search)
  if (includeInactive) params.set("include_inactive", "true")
  return useQuery<PaginatedResponse<InsurerListItem>>({
    queryKey: [...insurerKeys.list(search), includeInactive],
    queryFn: () =>
      apiFetch<PaginatedResponse<InsurerListItem>>(`${API}/?${params.toString()}`),
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
  cnpjs?: string[]
  trade_names?: string[]
  brand_color?: string
  abbreviation?: string
  logo_url?: string
  uses_cilia?: boolean
  is_active?: boolean
}

export const useInsurerCreate = () => useCreate<Insurer, InsurerPayload>("insurers")
export const useInsurerUpdate = () => useUpdate<Insurer, Partial<InsurerPayload>>("insurers")

/** Seguradora não se apaga: desativa e reativa por PATCH. */
export function useSetInsurerActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiFetch<Insurer>(`${API}/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: insurerKeys.all }),
  })
}

// ─── Tomador da nota (Person INSURER por CNPJ) — ADMIN+ ───────────────────────

const tomadorSchema = z.object({
  cnpj: z.string(),
  person_id: z.number().int().nullable(),
  person_name: z.string(),
  has_address: z.boolean(),
})
export type InsurerTomador = z.infer<typeof tomadorSchema>

export function useInsurerTomadores(insurerId: string, enabled = true) {
  return useQuery({
    queryKey: insurerKeys.tomadores(insurerId),
    queryFn: async () =>
      z.array(tomadorSchema).parse(await apiFetch<unknown>(`${API}/${insurerId}/tomadores/`)),
    enabled: !!insurerId && enabled,
  })
}

export function useCreateInsurerTomador(insurerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cnpj: string) =>
      z.object({ person_id: z.number().int() }).parse(
        await apiFetch<unknown>(`${API}/${insurerId}/tomador/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnpj }),
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: insurerKeys.tomadores(insurerId) }),
  })
}

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
