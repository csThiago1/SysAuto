/**
 * Paddock Solutions — dscar-web
 * Ciclo 06C: NFS-e Manaus — hooks TanStack Query v5
 *
 * Hooks:
 *   useFiscalDocuments   — lista de documentos fiscais (com filtros)
 *   useFiscalDocument    — detalhe de um documento
 *   useEmitNfse          — emite NFS-e a partir de uma OS (CONSULTANT+)
 *   useEmitManualNfse    — emite NFS-e manual ad-hoc (ADMIN+)
 *   useCancelFiscalDoc   — cancela documento fiscal (MANAGER+)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  FiscalDocument,
  FiscalDocumentList,
  ManualNfseInput,
} from "@paddock/types"
import { apiFetch } from "@/lib/api"

const FISCAL = "/api/proxy/fiscal"

// ─── fetchList helper ─────────────────────────────────────────────────────────

async function fetchList<T>(url: string): Promise<T[]> {
  const data = await apiFetch<{ results: T[] } | T[]>(url)
  if (data && !Array.isArray(data) && "results" in data) return data.results
  return data as T[]
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const fiscalKeys = {
  all: ["fiscal"] as const,
  documents: (params = "") => ["fiscal", "documents", params] as const,
  document: (id: string) => ["fiscal", "documents", id] as const,
}

// ─── Params ───────────────────────────────────────────────────────────────────

export interface FiscalDocumentParams {
  service_order?: string
  document_type?: string
  status?: string
}

// ─── Hooks — leitura ─────────────────────────────────────────────────────────

export function useFiscalDocuments(params: FiscalDocumentParams = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => Boolean(v))
    )
  ).toString()
  const url = `${FISCAL}/documents/${qs ? `?${qs}` : ""}`

  return useQuery({
    queryKey: fiscalKeys.documents(qs),
    queryFn: () => fetchList<FiscalDocumentList>(url),
  })
}

export function useFiscalDocument(id: string) {
  return useQuery({
    queryKey: fiscalKeys.document(id),
    queryFn: () => apiFetch<FiscalDocument>(`${FISCAL}/documents/${id}/`),
    enabled: Boolean(id),
  })
}

// ─── Hooks — mutações ────────────────────────────────────────────────────────

/** Emite NFS-e a partir de uma OS (CONSULTANT+). */
export function useEmitNfse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (serviceOrderId: string) =>
      apiFetch<FiscalDocument>(`${FISCAL}/nfse/emit/`, {
        method: "POST",
        body: JSON.stringify({ service_order_id: serviceOrderId }),
      }),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: fiscalKeys.all })
      if (doc.service_order_id) {
        // Invalida a OS para refletir o novo documento fiscal
        qc.invalidateQueries({ queryKey: ["service-orders", doc.service_order_id] })
      }
    },
  })
}

/** Emite NFS-e manual ad-hoc sem OS vinculada (ADMIN+). */
export function useEmitManualNfse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ManualNfseInput) =>
      apiFetch<FiscalDocument>(`${FISCAL}/nfse/emit-manual/`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.all })
    },
  })
}

/** Cancela documento fiscal autorizado (MANAGER+). */
export function useCancelFiscalDoc() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, justificativa }: { id: string; justificativa: string }) =>
      apiFetch<FiscalDocument>(`${FISCAL}/documents/${id}/`, {
        method: "DELETE",
        body: JSON.stringify({ justificativa }),
      }),
    onSuccess: (_doc, { id }) => {
      qc.invalidateQueries({ queryKey: fiscalKeys.all })
      qc.invalidateQueries({ queryKey: fiscalKeys.document(id) })
    },
  })
}
