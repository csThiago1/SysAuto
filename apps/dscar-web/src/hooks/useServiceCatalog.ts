"use client"

/**
 * Hooks para Catálogo de Serviços e Mão de Obra em OS — TanStack Query v5
 * Sprint 16 — SC-3
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type {
  ServiceCatalogItem,
  ServiceCatalogDetail,
  ServiceCatalogCreatePayload,
  ServiceCatalogUpdatePayload,
  ServiceLaborItem,
  ServiceLaborCreatePayload,
} from "@paddock/types"

const PROXY = "/api/proxy"
const CATALOG_API = `${PROXY}/service-catalog`
const OS_API = `${PROXY}/service-orders`

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const catalogKeys = {
  all: ["service-catalog"] as const,
  list: (params?: Record<string, string>) =>
    [...catalogKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...catalogKeys.all, "detail", id] as const,
  labor: (osId: string) => ["service-orders", osId, "labor"] as const,
}

// ─── Paginated wrapper ────────────────────────────────────────────────────────

interface PaginatedResult<T> {
  count: number
  results: T[]
}

// ─── Catalog CRUD ─────────────────────────────────────────────────────────────

export function useServiceCatalog(
  params?: Record<string, string>
): ReturnType<typeof useQuery<PaginatedResult<ServiceCatalogItem>>> {
  return useQuery<PaginatedResult<ServiceCatalogItem>>({
    queryKey: catalogKeys.list(params),
    queryFn: () => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : ""
      return apiFetch<PaginatedResult<ServiceCatalogItem>>(`${CATALOG_API}/${qs}`)
    },
  })
}

export function useServiceCatalogCreate(): ReturnType<
  typeof useMutation<ServiceCatalogDetail, Error, ServiceCatalogCreatePayload>
> {
  const qc = useQueryClient()
  return useMutation<ServiceCatalogDetail, Error, ServiceCatalogCreatePayload>({
    mutationFn: (payload: ServiceCatalogCreatePayload) =>
      apiFetch<ServiceCatalogDetail>(`${CATALOG_API}/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

export function useServiceCatalogUpdate(
  id: string
): ReturnType<typeof useMutation<ServiceCatalogDetail, Error, ServiceCatalogUpdatePayload>> {
  const qc = useQueryClient()
  return useMutation<ServiceCatalogDetail, Error, ServiceCatalogUpdatePayload>({
    mutationFn: (payload: ServiceCatalogUpdatePayload) =>
      apiFetch<ServiceCatalogDetail>(`${CATALOG_API}/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

export function useServiceCatalogDelete(): ReturnType<
  typeof useMutation<void, Error, string>
> {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id: string) =>
      apiFetch<void>(`${CATALOG_API}/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

// ─── OS Labor Items ───────────────────────────────────────────────────────────

export function useOSLaborItems(
  osId: string
): ReturnType<typeof useQuery<ServiceLaborItem[]>> {
  return useQuery<ServiceLaborItem[]>({
    queryKey: catalogKeys.labor(osId),
    queryFn: () => apiFetch<ServiceLaborItem[]>(`${OS_API}/${osId}/labor/`),
    enabled: Boolean(osId),
  })
}

export function useOSLaborCreate(
  osId: string
): ReturnType<typeof useMutation<ServiceLaborItem, Error, ServiceLaborCreatePayload>> {
  const qc = useQueryClient()
  return useMutation<ServiceLaborItem, Error, ServiceLaborCreatePayload>({
    mutationFn: (payload: ServiceLaborCreatePayload) =>
      apiFetch<ServiceLaborItem>(`${OS_API}/${osId}/labor/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.labor(osId) })
      qc.invalidateQueries({ queryKey: ["service-orders", osId] })
    },
  })
}

interface LaborUpdateArgs {
  laborId: string
  payload: Partial<ServiceLaborCreatePayload>
}

export function useOSLaborUpdate(
  osId: string
): ReturnType<typeof useMutation<ServiceLaborItem, Error, LaborUpdateArgs>> {
  const qc = useQueryClient()
  return useMutation<ServiceLaborItem, Error, LaborUpdateArgs>({
    mutationFn: ({ laborId, payload }: LaborUpdateArgs) =>
      apiFetch<ServiceLaborItem>(`${OS_API}/${osId}/labor/${laborId}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.labor(osId) })
      qc.invalidateQueries({ queryKey: ["service-orders", osId] })
    },
  })
}

export function useOSLaborDelete(
  osId: string
): ReturnType<typeof useMutation<void, Error, string>> {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (laborId: string) =>
      apiFetch<void>(`${OS_API}/${osId}/labor/${laborId}/`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.labor(osId) })
      qc.invalidateQueries({ queryKey: ["service-orders", osId] })
    },
  })
}
