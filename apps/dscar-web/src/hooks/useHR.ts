/**
 * HR hooks — TanStack Query v5
 * Sprint 7: Employee, Documents, SalaryHistory
 * Sprint 8: TimeClock, Goals, Allowances, Bonuses, Deductions, WorkSchedule, Payslips
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PaginatedResponse,
  Employee,
  EmployeeListItem,
  EmployeeDocument,
  SalaryHistory,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  CreateSalaryHistoryPayload,
  DailySummary,
  TimeClockEntry,
  RegisterClockPayload,
  GoalTarget,
  CreateGoalPayload,
  Allowance,
  CreateAllowancePayload,
  Bonus,
  CreateBonusPayload,
  Deduction,
  CreateDeductionPayload,
  WorkSchedule,
  Payslip,
  GeneratePayslipPayload,
} from "@paddock/types";
import { apiFetch } from "@/lib/api";

const API = "/api/proxy/hr";

// ── Query keys ────────────────────────────────────────────────────────────────

export const hrKeys = {
  employees: (filters?: Record<string, string>) =>
    filters ? ["hr-employees", filters] : ["hr-employees"],
  employee: (id: string) => ["hr-employees", id],
  documents: (employeeId: string) => ["hr-employee-documents", employeeId],
  salaryHistory: (employeeId: string) => ["hr-salary-history", employeeId],
} as const;

// ── Employee hooks ────────────────────────────────────────────────────────────

export function useEmployees(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<PaginatedResponse<EmployeeListItem>>({
    queryKey: hrKeys.employees(filters),
    queryFn: () =>
      apiFetch<PaginatedResponse<EmployeeListItem>>(
        `${API}/employees/${params ? `?${params}` : ""}`
      ),
  });
}

export function useEmployee(id: string) {
  return useQuery<Employee>({
    queryKey: hrKeys.employee(id),
    queryFn: () => apiFetch<Employee>(`${API}/employees/${id}/`),
    enabled: Boolean(id),
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation<Employee, Error, CreateEmployeePayload>({
    mutationFn: (payload) =>
      apiFetch<Employee>(`${API}/employees/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrKeys.employees() });
      toast.success("Colaborador admitido com sucesso.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao admitir colaborador.");
    },
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation<Employee, Error, UpdateEmployeePayload>({
    mutationFn: (payload) =>
      apiFetch<Employee>(`${API}/employees/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrKeys.employee(id) });
      void qc.invalidateQueries({ queryKey: hrKeys.employees() });
      toast.success("Dados atualizados.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao atualizar colaborador.");
    },
  });
}

export function useTerminateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation<Employee, Error, void>({
    mutationFn: () =>
      apiFetch<Employee>(`${API}/employees/${id}/terminate/`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrKeys.employee(id) });
      void qc.invalidateQueries({ queryKey: hrKeys.employees() });
      toast.success("Colaborador desligado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao desligar colaborador.");
    },
  });
}

// ── Document hooks ────────────────────────────────────────────────────────────

export function useEmployeeDocuments(employeeId: string) {
  return useQuery<PaginatedResponse<EmployeeDocument>>({
    queryKey: hrKeys.documents(employeeId),
    queryFn: () =>
      apiFetch<PaginatedResponse<EmployeeDocument>>(
        `${API}/employees/${employeeId}/documents/`
      ),
    enabled: Boolean(employeeId),
  });
}

// ── Salary History hooks ──────────────────────────────────────────────────────

export function useSalaryHistory(employeeId: string) {
  return useQuery<PaginatedResponse<SalaryHistory>>({
    queryKey: hrKeys.salaryHistory(employeeId),
    queryFn: () =>
      apiFetch<PaginatedResponse<SalaryHistory>>(
        `${API}/employees/${employeeId}/salary-history/`
      ),
    enabled: Boolean(employeeId),
  });
}

export function useCreateSalaryHistory(employeeId: string) {
  const qc = useQueryClient();
  return useMutation<SalaryHistory, Error, CreateSalaryHistoryPayload>({
    mutationFn: (payload) =>
      apiFetch<SalaryHistory>(
        `${API}/employees/${employeeId}/salary-history/`,
        { method: "POST", body: JSON.stringify(payload) }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrKeys.salaryHistory(employeeId) });
      void qc.invalidateQueries({ queryKey: hrKeys.employee(employeeId) });
      toast.success("Reajuste registrado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao registrar reajuste.");
    },
  });
}

// ── Sprint 8 hooks ────────────────────────────────────────────────────────────

// ── My Employee profile ───────────────────────────────────────────────────────

export function useMyEmployee() {
  return useQuery<Employee>({
    queryKey: ["hr-my-employee"],
    queryFn: () => apiFetch<Employee>(`${API}/employees/me/`),
    retry: false,
  });
}

// ── Time Clock hooks ──────────────────────────────────────────────────────────

export function useDailySummary(day: string) {
  return useQuery<DailySummary>({
    queryKey: ["hr-daily-summary", day],
    queryFn: () => apiFetch<DailySummary>(`${API}/time-clock/daily/${day}/`),
    enabled: Boolean(day),
    refetchInterval: 60_000, // refresh every minute on ponto page
  });
}

export function useRegisterClock() {
  const qc = useQueryClient();
  return useMutation<TimeClockEntry, Error, RegisterClockPayload>({
    mutationFn: (payload) =>
      apiFetch<TimeClockEntry>(`${API}/time-clock/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_, vars) => {
      const today = new Date().toISOString().split("T")[0];
      void qc.invalidateQueries({ queryKey: ["hr-daily-summary", today] });
      void qc.invalidateQueries({ queryKey: ["hr-time-clock"] });
      toast.success("Ponto registrado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao registrar ponto.");
    },
  });
}

// ── Bonus hooks ───────────────────────────────────────────────────────────────

export function useEmployeeBonuses(employeeId: string) {
  return useQuery<PaginatedResponse<Bonus>>({
    queryKey: ["hr-employee-bonuses", employeeId],
    queryFn: () =>
      apiFetch<PaginatedResponse<Bonus>>(
        `${API}/employees/${employeeId}/bonuses/`
      ),
    enabled: Boolean(employeeId),
  });
}

export function useCreateBonus(employeeId: string) {
  const qc = useQueryClient();
  return useMutation<Bonus, Error, CreateBonusPayload>({
    mutationFn: (payload) =>
      apiFetch<Bonus>(`${API}/employees/${employeeId}/bonuses/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-employee-bonuses", employeeId] });
      toast.success("Bonificação registrada.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao registrar bonificação.");
    },
  });
}

// ── Deduction hooks ───────────────────────────────────────────────────────────

export function useEmployeeDeductions(employeeId: string) {
  return useQuery<PaginatedResponse<Deduction>>({
    queryKey: ["hr-employee-deductions", employeeId],
    queryFn: () =>
      apiFetch<PaginatedResponse<Deduction>>(
        `${API}/employees/${employeeId}/deductions/`
      ),
    enabled: Boolean(employeeId),
  });
}

export function useCreateDeduction(employeeId: string) {
  const qc = useQueryClient();
  return useMutation<Deduction, Error, CreateDeductionPayload>({
    mutationFn: (payload) =>
      apiFetch<Deduction>(`${API}/employees/${employeeId}/deductions/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-employee-deductions", employeeId] });
      toast.success("Desconto registrado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao registrar desconto.");
    },
  });
}

// ── Work Schedule hooks ───────────────────────────────────────────────────────

export function useEmployeeSchedules(employeeId: string) {
  return useQuery<PaginatedResponse<WorkSchedule>>({
    queryKey: ["hr-employee-schedules", employeeId],
    queryFn: () =>
      apiFetch<PaginatedResponse<WorkSchedule>>(
        `${API}/employees/${employeeId}/schedules/`
      ),
    enabled: Boolean(employeeId),
  });
}

// ── Goal hooks ────────────────────────────────────────────────────────────────

export function useGoals(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<PaginatedResponse<GoalTarget>>({
    queryKey: ["hr-goals", filters],
    queryFn: () =>
      apiFetch<PaginatedResponse<GoalTarget>>(
        `${API}/goals/${params ? `?${params}` : ""}`
      ),
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation<GoalTarget, Error, CreateGoalPayload>({
    mutationFn: (payload) =>
      apiFetch<GoalTarget>(`${API}/goals/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-goals"] });
      toast.success("Meta criada.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao criar meta.");
    },
  });
}

export function useAchieveGoal() {
  const qc = useQueryClient();
  return useMutation<GoalTarget, Error, string>({
    mutationFn: (id) =>
      apiFetch<GoalTarget>(`${API}/goals/${id}/achieve/`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-goals"] });
      toast.success("Meta marcada como atingida. Bônus gerado automaticamente.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao atingir meta.");
    },
  });
}

// ── Allowance hooks ───────────────────────────────────────────────────────────

export function useAllowances(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<PaginatedResponse<Allowance>>({
    queryKey: ["hr-allowances", filters],
    queryFn: () =>
      apiFetch<PaginatedResponse<Allowance>>(
        `${API}/allowances/${params ? `?${params}` : ""}`
      ),
  });
}

export function useApproveAllowance() {
  const qc = useQueryClient();
  return useMutation<Allowance, Error, string>({
    mutationFn: (id) =>
      apiFetch<Allowance>(`${API}/allowances/${id}/approve/`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-allowances"] });
      toast.success("Vale aprovado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao aprovar vale.");
    },
  });
}

export function usePayAllowance() {
  const qc = useQueryClient();
  return useMutation<
    Allowance,
    Error,
    { id: string; receipt_file_key?: string }
  >({
    mutationFn: ({ id, receipt_file_key = "" }) =>
      apiFetch<Allowance>(`${API}/allowances/${id}/pay/`, {
        method: "POST",
        body: JSON.stringify({ receipt_file_key }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-allowances"] });
      toast.success("Vale marcado como pago.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao marcar vale como pago.");
    },
  });
}

// ── Payslip hooks ─────────────────────────────────────────────────────────────

export function usePayslips(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters).toString();
  return useQuery<PaginatedResponse<Payslip>>({
    queryKey: ["hr-payslips", filters],
    queryFn: () =>
      apiFetch<PaginatedResponse<Payslip>>(
        `${API}/payslips/${params ? `?${params}` : ""}`
      ),
  });
}

export function usePayslip(id: string) {
  return useQuery<Payslip>({
    queryKey: ["hr-payslips", id],
    queryFn: () => apiFetch<Payslip>(`${API}/payslips/${id}/`),
    enabled: Boolean(id),
  });
}

export function useGeneratePayslip() {
  const qc = useQueryClient();
  return useMutation<Payslip, Error, GeneratePayslipPayload>({
    mutationFn: (payload) =>
      apiFetch<Payslip>(`${API}/payslips/generate/`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-payslips"] });
      toast.success("Contracheque gerado.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao gerar contracheque.");
    },
  });
}

export function useClosePayslip() {
  const qc = useQueryClient();
  return useMutation<Payslip, Error, string>({
    mutationFn: (id) =>
      apiFetch<Payslip>(`${API}/payslips/${id}/close/`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-payslips"] });
      toast.success("Contracheque fechado e imutável.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao fechar contracheque.");
    },
  });
}

export function useEmployeePayslips(employeeId: string) {
  return useQuery<PaginatedResponse<Payslip>>({
    queryKey: ["hr-payslips", { employee: employeeId }],
    queryFn: () =>
      apiFetch<PaginatedResponse<Payslip>>(
        `${API}/payslips/?employee=${employeeId}`
      ),
    enabled: Boolean(employeeId),
  });
}
