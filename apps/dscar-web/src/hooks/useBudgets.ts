"use client"

/**
 * Paddock Solutions — useBudgets
 * Orçamentos Particulares (apps.budgets): CRUD, versões, itens, fluxo de estado.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  Budget,
  BudgetApprovePayload,
  BudgetCreatePayload,
  BudgetItemCreatePayload,
  BudgetListItem,
  BudgetVersion,
  BudgetVersionItem,
} from "@paddock/types"

const BASE = "/api/proxy/budgets"

type Paginated<T> = { results: T[]; count: number; next: string | null; previous: string | null }

async function fetchList<T>(url: string): Promise<T[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  const data = (await res.json()) as Paginated<T> | T[]
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText })) as Record<string, unknown>
    const message =
      (err.detail as string | undefined) ??
      (err.erro as string | undefined) ??
      (err.non_field_errors as string[] | undefined)?.[0] ??
      `${init?.method ?? "GET"} ${url} → ${res.status}`
    throw new Error(message)
  }
  // DELETE returns 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Query Keys ────────────────────────────────────────────────────────────────

export const budgetKeys = {
  all:      ["budgets"] as const,
  lists:    () => [...budgetKeys.all, "list"] as const,
  list:     (f?: Record<string, string>) => [...budgetKeys.lists(), f] as const,
  detail:   (id: string | number) => [...budgetKeys.all, String(id)] as const,
  versions: (id: string | number) => [...budgetKeys.detail(id), "versions"] as const,
  items:    (id: string | number, vId: string | number) =>
    [...budgetKeys.versions(id), String(vId), "items"] as const,
}

// ── Hooks de leitura ──────────────────────────────────────────────────────────

export function useBudgets(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters ?? {}).toString()
  return useQuery({
    queryKey: budgetKeys.list(filters),
    queryFn:  () => fetchList<BudgetListItem>(`${BASE}/${params ? "?" + params : ""}`),
  })
}

export function useBudget(id: string | number) {
  return useQuery({
    queryKey: budgetKeys.detail(id),
    queryFn:  () => apiFetch<Budget>(`${BASE}/${id}/`),
    enabled:  !!id,
  })
}

export function useBudgetVersions(budgetId: string | number) {
  return useQuery({
    queryKey: budgetKeys.versions(budgetId),
    queryFn:  () => fetchList<BudgetVersion>(`${BASE}/${budgetId}/versions/`),
    enabled:  !!budgetId,
  })
}

export function useBudgetItems(budgetId: string | number, versionId: string | number) {
  return useQuery({
    queryKey: budgetKeys.items(budgetId, versionId),
    queryFn:  () => fetchList<BudgetVersionItem>(
      `${BASE}/${budgetId}/versions/${versionId}/items/`
    ),
    enabled: !!budgetId && !!versionId,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BudgetCreatePayload) =>
      apiFetch<Budget>(`${BASE}/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetKeys.lists() }),
  })
}

export function useCloneBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (budgetId: number) =>
      apiFetch<Budget>(`${BASE}/${budgetId}/clone/`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: budgetKeys.lists() }),
  })
}

export function useSendBudget(budgetId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: number) =>
      apiFetch<BudgetVersion>(`${BASE}/${budgetId}/versions/${versionId}/send/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.versions(budgetId) })
    },
  })
}

export function useApproveBudget(budgetId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ versionId, payload }: { versionId: number; payload: BudgetApprovePayload }) =>
      apiFetch<{ version: BudgetVersion; service_order: { id: number; number: number } }>(
        `${BASE}/${budgetId}/versions/${versionId}/approve/`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.versions(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.lists() })
    },
  })
}

export function useRejectBudget(budgetId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: number) =>
      apiFetch<BudgetVersion>(`${BASE}/${budgetId}/versions/${versionId}/reject/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.versions(budgetId) })
    },
  })
}

export function useRequestRevision(budgetId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (versionId: number) =>
      apiFetch<BudgetVersion>(`${BASE}/${budgetId}/versions/${versionId}/revision/`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
      qc.invalidateQueries({ queryKey: budgetKeys.versions(budgetId) })
    },
  })
}

export function useCreateBudgetItem(budgetId: string | number, versionId: string | number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BudgetItemCreatePayload) =>
      apiFetch<BudgetVersionItem>(
        `${BASE}/${budgetId}/versions/${versionId}/items/`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.items(budgetId, versionId) })
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
    },
  })
}

export function useDeleteBudgetItem(
  budgetId: string | number,
  versionId: string | number
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) =>
      apiFetch<void>(
        `${BASE}/${budgetId}/versions/${versionId}/items/${itemId}/`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: budgetKeys.items(budgetId, versionId) })
      qc.invalidateQueries({ queryKey: budgetKeys.detail(budgetId) })
    },
  })
}
