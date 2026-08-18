import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, fetchList } from "@/lib/api";
import { useCreate, useDelete, useUpdate } from "@/lib/crud-mutations";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FollowUpStatus = "scheduled" | "pending" | "done" | "skipped";
export type FollowUpChannel = "task" | "whatsapp";
export type FollowUpOutcome =
  | "satisfied"
  | "dissatisfied"
  | "no_answer"
  | "scheduled_os"
  | "not_interested";

export interface FollowUpRule {
  id: string;
  name: string;
  trigger_event: string;
  delay_hours: number;
  channel: FollowUpChannel;
  message_template: string;
  link: string;
  os_types: string[];
  is_active: boolean;
}

export type FollowUpRulePayload = Omit<FollowUpRule, "id">;

export interface FollowUp {
  id: string;
  rule: string;
  rule_name: string;
  service_order: string;
  os_number: number;
  plate: string;
  customer_name: string;
  due_at: string;
  status: FollowUpStatus;
  channel: FollowUpChannel;
  assigned_to: string | null;
  assigned_to_name: string;
  dispatched_at: string | null;
  completed_at: string | null;
  outcome: FollowUpOutcome | "";
  notes: string;
  link: string;
  message: string;
}

// ── Fila de retornos ──────────────────────────────────────────────────────────

export function useFollowups(params: { onlyMine?: boolean } = {}) {
  const query = params.onlyMine ? "?assigned_to_me=true&page_size=200" : "?page_size=200";
  return useQuery<FollowUp[]>({
    queryKey: ["followups", params.onlyMine ?? false],
    queryFn: () => fetchList<FollowUp>(`/api/proxy/followups/${query}`),
  });
}

/** Ações do retorno: complete / reschedule / skip. */
function useFollowupAction<TBody>(action: "complete" | "reschedule" | "skip") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TBody }) =>
      apiFetch<FollowUp>(`/api/proxy/followups/${id}/${action}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["followups"] }),
  });
}

export const useCompleteFollowup = () =>
  useFollowupAction<{ outcome: FollowUpOutcome; notes: string }>("complete");
export const useRescheduleFollowup = () =>
  useFollowupAction<{ due_at: string }>("reschedule");
export const useSkipFollowup = () => useFollowupAction<{ notes: string }>("skip");

// ── Regras ────────────────────────────────────────────────────────────────────

export function useFollowupRules() {
  return useQuery<FollowUpRule[]>({
    queryKey: ["followups-rules"],
    queryFn: () => fetchList<FollowUpRule>("/api/proxy/followups/rules/?page_size=200"),
  });
}

const RULES_KEY = { invalidateKey: ["followups-rules"] };

export const useCreateFollowupRule = () =>
  useCreate<FollowUpRule, FollowUpRulePayload>("followups/rules", RULES_KEY);
export const useUpdateFollowupRule = () =>
  useUpdate<FollowUpRule, Partial<FollowUpRulePayload>>("followups/rules", RULES_KEY);
export const useDeleteFollowupRule = () => useDelete("followups/rules", RULES_KEY);
