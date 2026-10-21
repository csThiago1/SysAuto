import { useInfiniteQuery } from "@tanstack/react-query"

import { catalogOptionSchema, paginatedSchema } from "@/components/vehicle/catalog.schema"
import { apiFetch } from "@/lib/api"

export type CatalogLevel = "makes" | "families" | "models" | "years"
export interface CatalogParams {
  tipo?: string
  marca?: number
  familia?: number
  modelo?: number
  ano?: number
}

const PARENT: Record<CatalogLevel, keyof CatalogParams> = {
  makes: "tipo",
  families: "marca",
  models: "familia",
  years: "modelo",
}
const pageSchema = paginatedSchema(catalogOptionSchema)

/** Opções de um nível do catálogo, paginadas no servidor (50 por página). */
export function useCatalogOptions(level: CatalogLevel, params: CatalogParams, search: string) {
  return useInfiniteQuery({
    queryKey: ["vehicle-catalog", level, params, search],
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams({ page_size: "50", page: String(pageParam) })
      for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v))
      if (search) qs.set("search", search)
      // URLSearchParams codifica espaço como "+"; aqui vai como %20
      const url = `/api/proxy/vehicle-catalog/${level}/?${qs.toString().replace(/\+/g, "%20")}`
      return pageSchema.parse(await apiFetch<unknown>(url))
    },
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastPage) => (last.next ? lastPage + 1 : undefined),
    enabled: params[PARENT[level]] !== undefined,
    staleTime: 5 * 60_000,
  })
}
