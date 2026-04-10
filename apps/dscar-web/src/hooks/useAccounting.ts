/**
 * Accounting hooks — TanStack Query v5
 * Sprint 11: ChartOfAccounts, FiscalPeriod, JournalEntries
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PaginatedResponse,
  ChartOfAccount,
  ChartOfAccountNode,
  FiscalPeriod,
  JournalEntry,
  JournalEntryListItem,
  CreateJournalEntryPayload,
  CreateChartOfAccountPayload,
} from "@paddock/types";
import { apiFetch } from "@/lib/api";

const API = "/api/proxy/accounting";

// ── Query keys ────────────────────────────────────────────────────────────────

export const accountingKeys = {
  accounts: (filters?: Record<string, string>) =>
    filters ? ["fin-accounts", filters] : ["fin-accounts"],
  account: (id: string) => ["fin-accounts", id],
  accountTree: () => ["fin-accounts-tree"],
  entries: (filters?: Record<string, string>) =>
    filters ? ["fin-entries", filters] : ["fin-entries"],
  entry: (id: string) => ["fin-entries", id],
  currentPeriod: () => ["fin-current-period"],
} as const;

// ── Chart of Accounts hooks ───────────────────────────────────────────────────

export function useChartOfAccounts(filters: Record<string, string> = {}): ReturnType<
  typeof useQuery<PaginatedResponse<ChartOfAccount>>
> {
  const params = new URLSearchParams(filters).toString();
  return useQuery<PaginatedResponse<ChartOfAccount>>({
    queryKey: accountingKeys.accounts(filters),
    queryFn: () =>
      apiFetch<PaginatedResponse<ChartOfAccount>>(
        `${API}/chart-of-accounts/${params ? `?${params}` : ""}`
      ),
  });
}

export function useChartOfAccountsTree(): ReturnType<
  typeof useQuery<ChartOfAccountNode[]>
> {
  return useQuery<ChartOfAccountNode[]>({
    queryKey: accountingKeys.accountTree(),
    queryFn: () =>
      apiFetch<ChartOfAccountNode[]>(`${API}/chart-of-accounts/tree/`),
  });
}

export function useAnalyticalAccounts(): ReturnType<
  typeof useQuery<PaginatedResponse<ChartOfAccount>>
> {
  return useQuery<PaginatedResponse<ChartOfAccount>>({
    queryKey: accountingKeys.accounts({ is_analytical: "true", page_size: "500" }),
    queryFn: () =>
      apiFetch<PaginatedResponse<ChartOfAccount>>(
        `${API}/chart-of-accounts/?is_analytical=true&page_size=500`
      ),
  });
}

export function useCreateChartOfAccount(): ReturnType<
  typeof useMutation<ChartOfAccount, Error, CreateChartOfAccountPayload>
> {
  const qc = useQueryClient();
  return useMutation<ChartOfAccount, Error, CreateChartOfAccountPayload>({
    mutationFn: (payload) =>
      apiFetch<ChartOfAccount>(`${API}/chart-of-accounts/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accountingKeys.accounts() });
      void qc.invalidateQueries({ queryKey: accountingKeys.accountTree() });
      toast.success("Conta criada com sucesso.");
    },
    onError: (err) => toast.error(err.message || "Erro ao criar conta."),
  });
}

// ── Journal Entry hooks ───────────────────────────────────────────────────────

export function useJournalEntries(
  filters: Record<string, string> = {}
): ReturnType<typeof useQuery<PaginatedResponse<JournalEntryListItem>>> {
  const params = new URLSearchParams(filters).toString();
  return useQuery<PaginatedResponse<JournalEntryListItem>>({
    queryKey: accountingKeys.entries(filters),
    queryFn: () =>
      apiFetch<PaginatedResponse<JournalEntryListItem>>(
        `${API}/journal-entries/${params ? `?${params}` : ""}`
      ),
  });
}

export function useJournalEntry(id: string): ReturnType<
  typeof useQuery<JournalEntry>
> {
  return useQuery<JournalEntry>({
    queryKey: accountingKeys.entry(id),
    queryFn: () => apiFetch<JournalEntry>(`${API}/journal-entries/${id}/`),
    enabled: Boolean(id),
  });
}

export function useCreateJournalEntry(): ReturnType<
  typeof useMutation<JournalEntry, Error, CreateJournalEntryPayload>
> {
  const qc = useQueryClient();
  return useMutation<JournalEntry, Error, CreateJournalEntryPayload>({
    mutationFn: (payload) =>
      apiFetch<JournalEntry>(`${API}/journal-entries/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: accountingKeys.entries() });
      toast.success("Lançamento criado com sucesso.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao criar lançamento.");
    },
  });
}

export function useApproveJournalEntry(): ReturnType<
  typeof useMutation<JournalEntry, Error, string>
> {
  const qc = useQueryClient();
  return useMutation<JournalEntry, Error, string>({
    mutationFn: (id) =>
      apiFetch<JournalEntry>(`${API}/journal-entries/${id}/approve/`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: accountingKeys.entry(id) });
      void qc.invalidateQueries({ queryKey: accountingKeys.entries() });
      toast.success("Lançamento aprovado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao aprovar lançamento.");
    },
  });
}

export function useReverseJournalEntry(): ReturnType<
  typeof useMutation<JournalEntry, Error, { id: string; description: string }>
> {
  const qc = useQueryClient();
  return useMutation<JournalEntry, Error, { id: string; description: string }>({
    mutationFn: ({ id, description }) =>
      apiFetch<JournalEntry>(`${API}/journal-entries/${id}/reverse/`, {
        method: "POST",
        body: JSON.stringify({ description }),
      }),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: accountingKeys.entry(id) });
      void qc.invalidateQueries({ queryKey: accountingKeys.entries() });
      toast.success("Lançamento estornado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao estornar lançamento.");
    },
  });
}

// ── Fiscal Period hooks ───────────────────────────────────────────────────────

export function useCurrentFiscalPeriod(): ReturnType<
  typeof useQuery<FiscalPeriod>
> {
  return useQuery<FiscalPeriod>({
    queryKey: accountingKeys.currentPeriod(),
    queryFn: () =>
      apiFetch<FiscalPeriod>(`${API}/fiscal-periods/current/`),
  });
}
