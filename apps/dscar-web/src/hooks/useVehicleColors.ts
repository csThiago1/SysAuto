import { useQuery } from "@tanstack/react-query"
import type { ApiSchema } from "@/types"
import { fetchList } from "@/lib/api"
import { useCreate, useUpdate, useDelete } from "@/lib/crud-mutations"

export type VehicleColor = ApiSchema<"VehicleColor">

export function useVehicleColorsList(search = "") {
  return useQuery({
    queryKey: ["vehicle-colors", search],
    queryFn: () => fetchList<VehicleColor>(`/api/proxy/vehicle-catalog/colors/?search=${encodeURIComponent(search)}`),
  })
}

const opts = { invalidateKey: ["vehicle-colors"] as const }

export const useCreateVehicleColor = () =>
  useCreate<VehicleColor, Partial<VehicleColor>>("vehicle-catalog/colors", opts)
export const useUpdateVehicleColor = () =>
  useUpdate<VehicleColor, Partial<VehicleColor>>("vehicle-catalog/colors", opts)
export const useDeleteVehicleColor = () => useDelete("vehicle-catalog/colors", opts)
