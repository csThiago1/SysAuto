/**
 * Paddock Solutions — dscar-web
 * Document Generation System — TanStack Query v5 Hooks
 *
 * Hooks:
 *   useDocumentHistory      — lista histórico de documentos gerados para uma OS
 *   useDocumentPreview      — prévia de documento antes de gerar
 *   useGenerateDocument     — gera e baixa documento em PDF
 *   useDocumentDownloadUrl  — URL para download de um documento existente
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type {
  DocumentGeneration,
  DocumentPreviewData,
  PDFDocumentType,
  GenerateDocumentPayload,
} from "@paddock/types"

const BASE = "/api/proxy/documents"

// ─── Query Key Factory ─────────────────────────────────────────────────────

const docKeys = {
  all: ["documents"] as const,
  history: (osId: string) => [...docKeys.all, "history", osId] as const,
  preview: (osId: string, type: PDFDocumentType) =>
    [...docKeys.all, "preview", osId, type] as const,
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Busca histórico de documentos gerados para uma OS
 *
 * @param osId - UUID da order de serviço
 * @returns { data: DocumentGeneration[], isLoading, error, ... }
 */
export function useDocumentHistory(osId: string) {
  return useQuery({
    queryKey: docKeys.history(osId),
    queryFn: () =>
      apiFetch<DocumentGeneration[]>(`${BASE}/os/${osId}/history/`),
    enabled: !!osId,
  })
}

/**
 * Prévia de documento antes de gerar — para validação inline no frontend
 *
 * @param osId - UUID da order de serviço
 * @param documentType - tipo de documento (os_report, warranty, settlement, receipt)
 * @param receivableId - UUID opcional do título a receber (para receipt)
 * @returns { data: DocumentPreviewData, isLoading, error, ... }
 */
export function useDocumentPreview(
  osId: string,
  documentType: PDFDocumentType | null,
  receivableId?: string,
) {
  const params = receivableId ? `?receivable_id=${receivableId}` : ""
  return useQuery({
    queryKey: docKeys.preview(osId, documentType!),
    queryFn: () =>
      apiFetch<DocumentPreviewData>(
        `${BASE}/os/${osId}/preview/${documentType}/${params}`,
      ),
    enabled: !!osId && !!documentType,
  })
}

/**
 * Gera documento em PDF e o armazena no S3 (dev: /media/)
 *
 * Invalida cache de histórico automaticamente após sucesso.
 *
 * @param osId - UUID da order de serviço
 * @returns { mutate, isPending, error, data: DocumentGeneration, ... }
 */
export function useGenerateDocument(osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: GenerateDocumentPayload) =>
      apiFetch<DocumentGeneration>(`${BASE}/os/${osId}/generate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: docKeys.history(osId) })
    },
  })
}

/**
 * URL para download direto de um documento já gerado
 *
 * @param docId - UUID do DocumentGeneration
 * @returns URL absoluta para download
 */
export function useDocumentDownloadUrl(docId: string): string {
  return `${BASE}/${docId}/download/`
}
