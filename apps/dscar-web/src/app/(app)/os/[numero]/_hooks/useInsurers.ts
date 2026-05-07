"use client"

import { useQuery } from "@tanstack/react-query"
import type { Insurer, PaginatedResponse } from "@paddock/types"
import { apiFetch } from "@/lib/api"

const API = "/api/proxy"

export function useInsurers(search = "") {
  const params = search ? `?search=${encodeURIComponent(search)}` : ""
  return useQuery<PaginatedResponse<Insurer>>({
    queryKey: ["insurers", search],
    queryFn: () => apiFetch<PaginatedResponse<Insurer>>(`${API}/insurers/${params}`),
    staleTime: 5 * 60 * 1000, // 5 min — seguradoras raramente mudam
  })
}
