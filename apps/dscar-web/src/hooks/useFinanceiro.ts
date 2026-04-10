/**
 * Hooks para Contas a Pagar e Contas a Receber — TanStack Query v5
 * Sprint 14
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PaginatedResponse,
  PayableDocumentListItem,
  PayableDocument,
  CreatePayableDocumentPayload,
  RecordPaymentPayload,
  Supplier,
  ReceivableDocumentListItem,
  ReceivableDocument,
  CreateReceivablePayload,
  RecordReceiptPayload,
} from "@paddock/types";
import { apiFetch } from "@/lib/api";

const AP = "/api/proxy/accounts-payable";
const AR = "/api/proxy/accounts-receivable";

// ── Query keys ────────────────────────────────────────────────────────────────

export const financeiroKeys = {
  payable: {
    all: ["accounts-payable"] as const,
    allDocuments: () => ["accounts-payable", "documents"] as const,
    documents: (filters: Record<string, string>) =>
      ["accounts-payable", "documents", filters] as const,
    document: (id: string) =>
      ["accounts-payable", "documents", id] as const,
    suppliers: () => ["accounts-payable", "suppliers"] as const,
  },
  receivable: {
    all: ["accounts-receivable"] as const,
    allDocuments: () => ["accounts-receivable", "documents"] as const,
    documents: (filters: Record<string, string>) =>
      ["accounts-receivable", "documents", filters] as const,
    document: (id: string) =>
      ["accounts-receivable", "documents", id] as const,
  },
};

// ── Accounts Payable hooks ────────────────────────────────────────────────────

export function usePayableDocuments(
  filters: Record<string, string> = {}
): ReturnType<typeof useQuery<PaginatedResponse<PayableDocumentListItem>>> {
  const params = new URLSearchParams(filters).toString();
  const queryKey = financeiroKeys.payable.documents(filters);
  return useQuery<PaginatedResponse<PayableDocumentListItem>>({
    queryKey,
    queryFn: () =>
      apiFetch<PaginatedResponse<PayableDocumentListItem>>(
        `${AP}/documents/${params ? `?${params}` : ""}`
      ),
  });
}

export function usePayableDocument(
  id: string
): ReturnType<typeof useQuery<PayableDocument>> {
  return useQuery<PayableDocument>({
    queryKey: financeiroKeys.payable.document(id),
    queryFn: () => apiFetch<PayableDocument>(`${AP}/documents/${id}/`),
    enabled: Boolean(id),
  });
}

export function useCreatePayable(): ReturnType<
  typeof useMutation<PayableDocument, Error, CreatePayableDocumentPayload>
> {
  const qc = useQueryClient();
  return useMutation<PayableDocument, Error, CreatePayableDocumentPayload>({
    mutationFn: (payload) =>
      apiFetch<PayableDocument>(`${AP}/documents/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: financeiroKeys.payable.allDocuments(),
      });
      toast.success("Título a pagar criado com sucesso.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao criar título a pagar.");
    },
  });
}

export function useRecordPayment(): ReturnType<
  typeof useMutation<
    PayableDocument,
    Error,
    { documentId: string } & RecordPaymentPayload
  >
> {
  const qc = useQueryClient();
  return useMutation<
    PayableDocument,
    Error,
    { documentId: string } & RecordPaymentPayload
  >({
    mutationFn: ({ documentId, ...payload }) =>
      apiFetch<PayableDocument>(`${AP}/documents/${documentId}/pay/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_, { documentId }) => {
      void qc.invalidateQueries({
        queryKey: financeiroKeys.payable.document(documentId),
      });
      void qc.invalidateQueries({
        queryKey: financeiroKeys.payable.allDocuments(),
      });
      toast.success("Pagamento registrado com sucesso.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao registrar pagamento.");
    },
  });
}

export function useCancelPayable(): ReturnType<
  typeof useMutation<PayableDocument, Error, { id: string; reason: string }>
> {
  const qc = useQueryClient();
  return useMutation<PayableDocument, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) =>
      apiFetch<PayableDocument>(`${AP}/documents/${id}/cancel/`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({
        queryKey: financeiroKeys.payable.document(id),
      });
      void qc.invalidateQueries({
        queryKey: financeiroKeys.payable.allDocuments(),
      });
      toast.success("Título cancelado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao cancelar título.");
    },
  });
}

export function useSuppliers(): ReturnType<
  typeof useQuery<PaginatedResponse<Supplier>>
> {
  return useQuery<PaginatedResponse<Supplier>>({
    queryKey: financeiroKeys.payable.suppliers(),
    queryFn: () =>
      apiFetch<PaginatedResponse<Supplier>>(
        `${AP}/suppliers/?page_size=500`
      ),
  });
}

export function useCreateSupplier(): ReturnType<
  typeof useMutation<
    Supplier,
    Error,
    Omit<Supplier, "id" | "is_active">
  >
> {
  const qc = useQueryClient();
  return useMutation<Supplier, Error, Omit<Supplier, "id" | "is_active">>({
    mutationFn: (payload) =>
      apiFetch<Supplier>(`${AP}/suppliers/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: financeiroKeys.payable.suppliers(),
      });
      toast.success("Fornecedor cadastrado com sucesso.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao cadastrar fornecedor.");
    },
  });
}

// ── Accounts Receivable hooks ─────────────────────────────────────────────────

export function useReceivableDocuments(
  filters: Record<string, string> = {}
): ReturnType<typeof useQuery<PaginatedResponse<ReceivableDocumentListItem>>> {
  const params = new URLSearchParams(filters).toString();
  return useQuery<PaginatedResponse<ReceivableDocumentListItem>>({
    queryKey: financeiroKeys.receivable.documents(filters),
    queryFn: () =>
      apiFetch<PaginatedResponse<ReceivableDocumentListItem>>(
        `${AR}/documents/${params ? `?${params}` : ""}`
      ),
  });
}

export function useReceivableDocument(
  id: string
): ReturnType<typeof useQuery<ReceivableDocument>> {
  return useQuery<ReceivableDocument>({
    queryKey: financeiroKeys.receivable.document(id),
    queryFn: () => apiFetch<ReceivableDocument>(`${AR}/documents/${id}/`),
    enabled: Boolean(id),
  });
}

export function useCreateReceivable(): ReturnType<
  typeof useMutation<ReceivableDocument, Error, CreateReceivablePayload>
> {
  const qc = useQueryClient();
  return useMutation<ReceivableDocument, Error, CreateReceivablePayload>({
    mutationFn: (payload) =>
      apiFetch<ReceivableDocument>(`${AR}/documents/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: financeiroKeys.receivable.allDocuments(),
      });
      toast.success("Título a receber criado com sucesso.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao criar título a receber.");
    },
  });
}

export function useRecordReceipt(): ReturnType<
  typeof useMutation<
    ReceivableDocument,
    Error,
    { documentId: string } & RecordReceiptPayload
  >
> {
  const qc = useQueryClient();
  return useMutation<
    ReceivableDocument,
    Error,
    { documentId: string } & RecordReceiptPayload
  >({
    mutationFn: ({ documentId, ...payload }) =>
      apiFetch<ReceivableDocument>(
        `${AR}/documents/${documentId}/receive/`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: (_, { documentId }) => {
      void qc.invalidateQueries({
        queryKey: financeiroKeys.receivable.document(documentId),
      });
      void qc.invalidateQueries({
        queryKey: financeiroKeys.receivable.allDocuments(),
      });
      toast.success("Recebimento registrado com sucesso.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao registrar recebimento.");
    },
  });
}

export function useCancelReceivable(): ReturnType<
  typeof useMutation<ReceivableDocument, Error, { id: string; reason: string }>
> {
  const qc = useQueryClient();
  return useMutation<
    ReceivableDocument,
    Error,
    { id: string; reason: string }
  >({
    mutationFn: ({ id, reason }) =>
      apiFetch<ReceivableDocument>(`${AR}/documents/${id}/cancel/`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({
        queryKey: financeiroKeys.receivable.document(id),
      });
      void qc.invalidateQueries({
        queryKey: financeiroKeys.receivable.allDocuments(),
      });
      toast.success("Título cancelado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao cancelar título.");
    },
  });
}
