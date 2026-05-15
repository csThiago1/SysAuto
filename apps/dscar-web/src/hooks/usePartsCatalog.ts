"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchList } from "@/lib/api"
import type { PartCatalogReference } from "@paddock/types"

interface PartsCatalogParams {
  search?: string
  vehicle_make_name?: string
  vehicle_model_name?: string
  category?: number
}

export function usePartsCatalog(params?: PartsCatalogParams) {
  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set("search", params.search)
  if (params?.vehicle_make_name) searchParams.set("vehicle_make_name", params.vehicle_make_name)
  if (params?.vehicle_model_name) searchParams.set("vehicle_model_name", params.vehicle_model_name)
  if (params?.category) searchParams.set("category", String(params.category))

  const qs = searchParams.toString()
  const enabled = !!params?.search && params.search.length >= 2

  return useQuery<PartCatalogReference[]>({
    queryKey: ["parts-catalog", "references", params],
    queryFn: () => fetchList<PartCatalogReference>(`/api/proxy/parts-catalog/references/?${qs}`),
    enabled,
    staleTime: 60_000,
  })
}
