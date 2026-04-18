/**
 * Hooks barrel — @/hooks
 *
 * Import limpo de qualquer hook do projeto.
 * Uso: import { usePersons, useServiceOrders, useDebounce } from "@/hooks"
 */

// ── Ordens de Serviço ─────────────────────────────────────────────────────────
export {
  useServiceOrders,
  useServiceOrder,
  useTransitionStatus,
  useDashboardStats,
} from "./useServiceOrders";

// ── Pessoas (Cadastros) ───────────────────────────────────────────────────────
export { usePersons, usePerson, type UsePersonsParams } from "./usePersons";
export {
  useCreatePerson,
  useUpdatePerson,
  useDeactivatePerson,
  useCepLookup,
} from "./usePersonMutations";

// ── Notificações ──────────────────────────────────────────────────────────────
export { useOverdueOrders } from "./useOverdueOrders";

// ── Relacionamentos ───────────────────────────────────────────────────────
export { useClientOrders } from "./useClientOrders";

// ── RH (Recursos Humanos) ─────────────────────────────────────────────────────
export {
  // Sprint 7
  useEmployees,
  useEmployee,
  useMyEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useTerminateEmployee,
  useEmployeeDocuments,
  useSalaryHistory,
  useCreateSalaryHistory,
  // Sprint 8 — TimeClock
  useDailySummary,
  useRegisterClock,
  // Sprint 8 — Bonus / Deduction / Schedule
  useEmployeeBonuses,
  useCreateBonus,
  useEmployeeDeductions,
  useCreateDeduction,
  useEmployeeSchedules,
  // Sprint 8 — Goals
  useGoals,
  useCreateGoal,
  useAchieveGoal,
  // Sprint 8 — Allowances
  useAllowances,
  useApproveAllowance,
  usePayAllowance,
  // Sprint 8 — Payslips
  usePayslips,
  usePayslip,
  useGeneratePayslip,
  useClosePayslip,
  useEmployeePayslips,
  hrKeys,
} from "./useHR";

// ── Financeiro (Contabilidade) ────────────────────────────────────────────────
export {
  // Sprint 11
  useChartOfAccounts,
  useChartOfAccountsTree,
  useAnalyticalAccounts,
  useCreateChartOfAccount,
  useJournalEntries,
  useJournalEntry,
  useCreateJournalEntry,
  useApproveJournalEntry,
  useReverseJournalEntry,
  useCurrentFiscalPeriod,
  accountingKeys,
} from "./useAccounting";

// ── Financeiro (Contas a Pagar / Contas a Receber) ────────────────────────────
export {
  // Sprint 14
  usePayableDocuments,
  usePayableDocument,
  useCreatePayable,
  useRecordPayment,
  useCancelPayable,
  useSuppliers,
  useCreateSupplier,
  useReceivableDocuments,
  useReceivableDocument,
  useCreateReceivable,
  useRecordReceipt,
  useCancelReceivable,
  financeiroKeys,
} from "./useFinanceiro";

// ── Seguradoras ──────────────────────────────────────────────────────────────
export {
  useInsurers,
  useInsurer,
  useInsurerCreate,
  useInsurerUpdate,
  useInsurerDelete,
  useInsurerUploadLogo,
  type InsurerPayload,
} from "./useInsurers";

// ── Motor de Orçamentos — Catálogo FIPE ───────────────────────────────────────
export {
  useFipeMakes,
  useFipeModels,
  useFipeYears,
  fipeKeys,
} from "./useVehicleFipe";

// ── Motor de Orçamentos — Enquadramento Veicular ──────────────────────────────
export { useResolverEnquadramento, enquadramentoKeys } from "./useEnquadramento";

// ── Motor de Orçamentos — Perfil Veicular CRUD ────────────────────────────────
export {
  useEmpresas,
  useEmpresa,
  useCreateEmpresa,
  useUpdateEmpresa,
  useSegmentos,
  useSegmento,
  useCreateSegmento,
  useUpdateSegmento,
  useTamanhos,
  useTamanho,
  useCreateTamanho,
  useUpdateTamanho,
  useTiposPintura,
  useTipoPintura,
  useCreateTipoPintura,
  useUpdateTipoPintura,
  useEnquadramentos,
  useEnquadramento,
  useCreateEnquadramento,
  useUpdateEnquadramento,
  useDeleteEnquadramento,
  pricingKeys,
  type EmpresaPayload,
  type SegmentoPayload,
  type TamanhoPayload,
  type TipoPinturaPayload,
  type EnquadramentoPayload,
} from "./usePricingProfile";

// ── UI / Utilitários ──────────────────────────────────────────────────────────
export { useDebounce } from "./useDebounce";
export { usePermission } from "./usePermission";
