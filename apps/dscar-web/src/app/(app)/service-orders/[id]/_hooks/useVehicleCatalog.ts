"use client"

import { useQuery } from "@tanstack/react-query"
import type { PaginatedResponse, VehicleColor } from "@paddock/types"
import { apiFetch } from "@/lib/api"

const API = "/api/proxy"

export function useVehicleColors() {
  return useQuery<PaginatedResponse<VehicleColor>>({
    queryKey: ["vehicle-colors"],
    queryFn: () =>
      apiFetch<PaginatedResponse<VehicleColor>>(`${API}/vehicle-catalog/colors/`),
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

interface PlateData {
  plate: string
  make: string
  model: string
  year: number | null
  chassis: string
  renavam: string
  city: string
}

export function usePlateLookup(plate: string) {
  const normalized = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  return useQuery<PlateData>({
    queryKey: ["plate", normalized],
    queryFn: () => apiFetch<PlateData>(`/api/plate/${normalized}`),
    enabled: normalized.length >= 7,
    retry: false,
  })
}
