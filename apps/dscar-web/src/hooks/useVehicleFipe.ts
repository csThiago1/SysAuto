/**
 * Hooks para catálogo FIPE — marcas, modelos e anos/versões.
 * staleTime: 24h (dados mudam raramente).
 */

import { useQuery } from "@tanstack/react-query"
import type { VehicleMake, VehicleModel, VehicleYearVersion } from "@paddock/types"
import { apiFetch } from "@/lib/api"

const FIPE_BASE = "/api/proxy/vehicle-catalog"

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const fipeKeys = {
  makes: ["fipe", "makes"] as const,
  models: (makeId: number) => ["fipe", "models", makeId] as const,
  years: (modelId: number) => ["fipe", "years", modelId] as const,
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useFipeMakes() {
  return useQuery<VehicleMake[]>({
    queryKey: fipeKeys.makes,
    queryFn: () => apiFetch<VehicleMake[]>(`${FIPE_BASE}/makes/`),
    staleTime: 24 * 60 * 60 * 1000, // 24h
  })
}

export function useFipeModels(makeId: number | null) {
  return useQuery<VehicleModel[]>({
    queryKey: fipeKeys.models(makeId ?? 0),
    queryFn: () => apiFetch<VehicleModel[]>(`${FIPE_BASE}/makes/${makeId!}/models/`),
    enabled: makeId !== null,
    staleTime: 24 * 60 * 60 * 1000, // 24h
  })
}

export function useFipeYears(modelId: number | null) {
  return useQuery<VehicleYearVersion[]>({
    queryKey: fipeKeys.years(modelId ?? 0),
    queryFn: () => apiFetch<VehicleYearVersion[]>(`${FIPE_BASE}/models/${modelId!}/years/`),
    enabled: modelId !== null,
    staleTime: 24 * 60 * 60 * 1000, // 24h
  })
}
