/**
 * Hook para resolver enquadramento veicular por marca/modelo/ano.
 * Lazy: só executa quando os três valores estão presentes e não vazios.
 */

import { useQuery } from "@tanstack/react-query"
import type { EnquadramentoResolve } from "@paddock/types"
import { apiFetch } from "@/lib/api"

interface ResolveInput {
  marca: string
  modelo: string
  ano: number
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const enquadramentoKeys = {
  resolve: (marca: string | null, modelo: string | null, ano: number | null) =>
    ["enquadramento", "resolver", marca, modelo, ano] as const,
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useResolverEnquadramento(
  marca: string | null,
  modelo: string | null,
  ano: number | null,
) {
  return useQuery<EnquadramentoResolve>({
    queryKey: enquadramentoKeys.resolve(marca, modelo, ano),
    queryFn: () => {
      const input: ResolveInput = { marca: marca!, modelo: modelo!, ano: ano! }
      return apiFetch<EnquadramentoResolve>("/api/proxy/pricing/enquadramentos/resolver/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    },
    enabled:
      marca !== null &&
      marca !== "" &&
      modelo !== null &&
      modelo !== "" &&
      ano !== null,
    staleTime: 60 * 60 * 1000, // 1h
  })
}
