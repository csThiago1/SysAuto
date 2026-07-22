import { useQuery } from "@tanstack/react-query"
import type { ApiSchema } from "@/types"
import { fetchList } from "@/lib/api"
import { useCreate, useUpdate, useDelete } from "@/lib/crud-mutations"

export type Bank = ApiSchema<"Bank">

export function useBanks(search = "") {
  return useQuery({
    queryKey: ["banks", search],
    queryFn: () => fetchList<Bank>(`/api/proxy/banks/?search=${encodeURIComponent(search)}`),
  })
}

export const useCreateBank = () => useCreate<Bank, Partial<Bank>>("banks")
export const useUpdateBank = () => useUpdate<Bank, Partial<Bank>>("banks")
export const useDeleteBank = () => useDelete("banks")
