import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  catalogOptionSchema,
  paginatedSchema,
  type VehicleTipo,
} from "@/components/vehicle/catalog.schema"
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

export const makeAdminSchema = catalogOptionSchema.extend({
  nome: z.string(),
  tipo: z.string(),
  is_active: z.boolean(),
})
export type MakeAdmin = z.infer<typeof makeAdminSchema>
const makeAdminPageSchema = paginatedSchema(makeAdminSchema)
const MAKES = "/api/proxy/vehicle-catalog/makes"

/** Montadoras do cadastro (ADMIN+), inclusive as desativadas. `tipo` null não busca. */
export function useMakesAdmin(tipo: VehicleTipo | null, search: string) {
  return useInfiniteQuery({
    queryKey: ["vehicle-catalog", "makes", "admin", tipo, search],
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams({
        tipo: tipo ?? "",
        include_inactive: "true",
        page_size: "50",
        page: String(pageParam),
      })
      if (search) qs.set("search", search)
      const url = `${MAKES}/?${qs.toString().replace(/\+/g, "%20")}`
      return makeAdminPageSchema.parse(await apiFetch<unknown>(url))
    },
    initialPageParam: 1,
    getNextPageParam: (last, _all, lastPage) => (last.next ? lastPage + 1 : undefined),
    enabled: tipo !== null,
  })
}

function usePatchMake<B extends object>(path: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: B & { id: number }) =>
      makeAdminSchema.parse(
        await apiFetch<unknown>(`${MAKES}/${id}/${path}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    // o prefixo cobre o cadastro (admin) e o useCatalogOptions("makes") do seletor
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicle-catalog", "makes"] }),
  })
}

/** PATCH /makes/{id}/logo/ */
export const useUpdateMakeLogo = () => usePatchMake<{ logo_url: string }>("logo/")
/** PATCH /makes/{id}/ com {is_active} */
export const useSetMakeActive = () => usePatchMake<{ is_active: boolean }>("")
