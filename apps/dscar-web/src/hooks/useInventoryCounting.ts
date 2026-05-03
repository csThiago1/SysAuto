/**
 * Paddock Solutions — dscar-web
 * WMS: Hooks TanStack Query v5 para Contagem de Inventario
 * ContagemInventario, ItemContagem
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AbrirContagemInput,
  ContagemInventario,
  ContagemInventarioDetail,
  RegistrarItemInput,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const INV = "/api/proxy/inventory"

// ─── fetchList helper (extrai .results do envelope DRF) ───────────────────────

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<{ results: T[] } | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const countingKeys = {
  all: ["inventory-counting"] as const,
  contagens: () => [...countingKeys.all, "contagens"] as const,
  contagem: (id: string) => [...countingKeys.all, "contagem", id] as const,
}

// ─── Contagens ────────────────────────────────────────────────────────────────

export function useContagens() {
  return useQuery<ContagemInventario[]>({
    queryKey: countingKeys.contagens(),
    queryFn: () =>
      fetchList<ContagemInventario>(`${INV}/contagens/`),
  })
}

export function useContagem(id: string) {
  return useQuery<ContagemInventarioDetail>({
    queryKey: countingKeys.contagem(id),
    queryFn: () =>
      apiFetch<ContagemInventarioDetail>(`${INV}/contagens/${id}/`),
    enabled: !!id,
  })
}

export function useContagemCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AbrirContagemInput) =>
      apiFetch<ContagemInventario>(`${INV}/contagens/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: countingKeys.contagens() }),
  })
}

export function useRegistrarItem(contagemId: string, itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: RegistrarItemInput) =>
      apiFetch<unknown>(
        `${INV}/contagens/${contagemId}/itens/${itemId}/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: countingKeys.contagem(contagemId) }),
  })
}

export function useFinalizarContagem(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<ContagemInventario>(`${INV}/contagens/${id}/finalizar/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: countingKeys.contagens() })
      qc.invalidateQueries({ queryKey: countingKeys.contagem(id) })
    },
  })
}

export function useCancelarContagem(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<ContagemInventario>(`${INV}/contagens/${id}/cancelar/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: countingKeys.contagens() })
      qc.invalidateQueries({ queryKey: countingKeys.contagem(id) })
    },
  })
}
