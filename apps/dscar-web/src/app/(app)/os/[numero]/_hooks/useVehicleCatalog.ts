"use client"

import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import { apiFetch } from "@/lib/api"

const API = "/api/proxy"

export const vehicleColorOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  hex: z.string(),
})
export type VehicleColorOption = z.infer<typeof vehicleColorOptionSchema>

export function useVehicleColors() {
  return useQuery<VehicleColorOption[]>({
    queryKey: ["vehicle-colors"],
    queryFn: async () =>
      z
        .array(vehicleColorOptionSchema)
        .parse(await apiFetch<unknown>(`${API}/vehicle-catalog/colors/`)),
    staleTime: 60 * 60 * 1000, // enum fixo no backend
  })
}
