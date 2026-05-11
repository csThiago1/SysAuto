/**
 * Paddock Solutions — dscar-web
 * Ciclo 06C/07A: NFS-e + NF-e de Produto — hooks TanStack Query v5
 *
 * Hooks:
 *   useFiscalDocuments   — lista de documentos fiscais (com filtros)
 *   useFiscalDocument    — detalhe de um documento
 *   useEmitNfse          — emite NFS-e a partir de uma OS (CONSULTANT+)
 *   useEmitManualNfse    — emite NFS-e manual ad-hoc (ADMIN+)
 *   useEmitNfe           — emite NF-e de produto a partir de uma OS (CONSULTANT+)
 *   useEmitManualNfe     — emite NF-e de produto manual ad-hoc (ADMIN+)
 *   useCancelFiscalDoc   — cancela documento fiscal (MANAGER+)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  FiscalDocument,
  FiscalDocumentList,
  FiscalDocumentParams,
  ManualNfeInput,
  ManualNfseInput,
  NfeEmitFromOsInput,
  NfeRecebida,
} from "@paddock/types"
import { apiFetch, fetchList } from "@/lib/api"

const FISCAL = "/api/proxy/fiscal"

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const fiscalKeys = {
  all: ["fiscal"] as const,
  documents: (params = "") => ["fiscal", "documents", params] as const,
  document: (id: string) => ["fiscal", "documents", id] as const,
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

// ─── Hooks NF-e de Produto (07A) ─────────────────────────────────────────────

/** Emite NF-e de produto a partir de uma OS (CONSULTANT+). */
export function useEmitNfe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ service_order_id, forma_pagamento = "01" }: NfeEmitFromOsInput) =>
      apiFetch<FiscalDocument>(`${FISCAL}/nfe/emit/`, {
        method: "POST",
        body: JSON.stringify({ service_order_id, forma_pagamento }),
      }),
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: fiscalKeys.all })
      if (doc.service_order_id) {
        qc.invalidateQueries({ queryKey: ["service-orders", doc.service_order_id] })
      }
    },
  })
}

/** Emite NF-e de produto manual ad-hoc sem OS vinculada (ADMIN+). */
export function useEmitManualNfe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ManualNfeInput) =>
      apiFetch<FiscalDocument>(`${FISCAL}/nfe/emit-manual/`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.all })
    },
  })
}

// ─── NF-e Recebidas ───────────────────────────────────────────────────────────

export function useNfeRecebidas(pagina = 1) {
  return useQuery({
    queryKey: ["fiscal", "nfe-recebidas", pagina],
    queryFn: () =>
      apiFetch<NfeRecebida[]>(`/api/proxy/fiscal/nfe-recebidas/?pagina=${pagina}`),
    staleTime: 1000 * 60 * 5, // 5 min
  })
}

export function useNfeRecebidaManifest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      chave,
      tipo_evento,
      justificativa,
    }: {
      chave: string
      tipo_evento: string
      justificativa?: string
    }) =>
      apiFetch(`/api/proxy/fiscal/nfe-recebidas/${chave}/manifesto/`, {
        method: "POST",
        body: JSON.stringify({ tipo_evento, justificativa }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal", "nfe-recebidas"] })
    },
  })
}

/** Envia documento fiscal autorizado por email (CONSULTANT+). */
export function useSendFiscalEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      documentId,
      emails,
    }: {
      documentId: string
      emails: string[]
    }) => {
      return apiFetch(`${FISCAL}/documents/${documentId}/send-email/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.all })
    },
  })
}

/** Emite Carta de Correção Eletrônica para NF-e autorizada (MANAGER+). */
export function useCCe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ documentId, correcao }: { documentId: string; correcao: string }) => {
      return apiFetch(`${FISCAL}/documents/${documentId}/cce/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correcao }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.all })
    },
  })
}

/** Substitui NFS-e autorizada emitindo nova em seu lugar (ADMIN+). */
export function useSubstituirNfse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      chave_nfse_substituida: string
      service_order_id?: string
      codigo_justificativa?: string
    }) => {
      return apiFetch<{ status: string; nova_ref: string }>(`${FISCAL}/nfse/substituir/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    },
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

// ─── S3-T3: Inutilização de Numeração NF-e ──────────────────────────────────

export function useInutilizacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      serie: number;
      numero_inicial: number;
      numero_final: number;
      justificativa: string;
    }) => {
      return apiFetch(`${FISCAL}/nfe/inutilizacao/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inutilizacoes"] })
    },
  })
}

export function useInutilizacoes() {
  return useQuery({
    queryKey: ["inutilizacoes"],
    queryFn: () => apiFetch<Array<{
      id: string;
      payload: Record<string, unknown>;
      response_data: Record<string, unknown>;
      created_at: string;
    }>>(`${FISCAL}/nfe/inutilizacoes/`),
  })
}

// ─── S4-T4: NF-e Recebida — download XML/DANFE ───────────────────────────────

/** Retorna a URL do proxy para download do XML de NF-e recebida. */
export function useNfeRecebidaFileUrl(chave: string, fileType: "xml" | "danfe"): string {
  return `/api/proxy/fiscal/nfe-recebidas/${chave}/file/${fileType}/`
}

// ─── Resumo Fiscal Mensal ────────────────────────────────────────────────────

export function useResumoFiscal(year: number, month: number) {
  return useQuery({
    queryKey: [...fiscalKeys.all, "resumo", year, month],
    queryFn: () => apiFetch<{
      year: number; month: number;
      nfse: { count: number; total: string };
      nfe: { count: number; total: string };
      impostos: { iss: string; icms: string; pis: string; cofins: string };
      total_emitidas: number; total_canceladas: number;
    }>(`${FISCAL}/resumo-mensal/?year=${year}&month=${month}`),
    enabled: Boolean(year && month),
  })
}

// ─── NFC-e (Cupom Fiscal Eletrônico) ─────────────────────────────────────────

/** Emite NFC-e ao consumidor (CONSULTANT+). */
export function useEmitNfce() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      itens: Array<{
        codigo_produto?: string;
        descricao: string;
        ncm: string;
        unidade?: string;
        quantidade: number;
        valor_unitario: string;
        valor_desconto?: string;
      }>;
      forma_pagamento?: string;
      cpf_destinatario?: string;
      nome_destinatario?: string;
      observacoes?: string;
    }) => {
      return apiFetch(`${FISCAL}/nfce/emit/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.all })
    },
  })
}

// ─── S4-T4: NF-e Entrada — match e link com Pedido de Compra ─────────────────

export interface PurchaseOrderMatch {
  id: string
  number: string
  supplier_name: string
  total: string
  status: string
  created_at: string
}

export function useNfeEntradaMatchPO(nfeEntradaId: string) {
  return useQuery({
    queryKey: ["nfe-entrada", nfeEntradaId, "match-po"],
    queryFn: () =>
      apiFetch<PurchaseOrderMatch[]>(`${FISCAL}/nfe-entrada/${nfeEntradaId}/match-po/`),
    enabled: Boolean(nfeEntradaId),
  })
}

export function useLinkPO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      nfeEntradaId,
      purchaseOrderId,
    }: {
      nfeEntradaId: string
      purchaseOrderId: string
    }) => {
      return apiFetch(`${FISCAL}/nfe-entrada/${nfeEntradaId}/link-po/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_order_id: purchaseOrderId }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nfe-entrada"] })
    },
  })
}
