import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { SignatureDocumentType } from "@/components/signatures/types"

interface SignatureListResponse {
  count: number
  results: unknown[]
}

export const signatureKeys = {
  exists: (orderId: string, docType: SignatureDocumentType) =>
    ["signatures", orderId, docType, "exists"] as const,
}

export function useSignatureExists(
  serviceOrderId: string,
  documentType: SignatureDocumentType,
) {
  return useQuery({
    queryKey: signatureKeys.exists(serviceOrderId, documentType),
    queryFn: async () => {
      const data = await apiFetch<SignatureListResponse>(
        `/api/proxy/signatures/?service_order=${serviceOrderId}&document_type=${documentType}&page_size=1`,
      )
      return data.count > 0
    },
    enabled: Boolean(serviceOrderId),
    staleTime: 30_000,
  })
}
