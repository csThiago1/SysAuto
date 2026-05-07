/**
 * Query key factory for Service Order detail pages — TanStack Query v5
 *
 * Consolidates the inconsistent ad-hoc keys scattered across hooks:
 *   - useOSItems.ts  used ["os-parts", id], ["os-labor", id], ["os-photos", id]
 *   - useOSItems.ts  used ["os-budget-snapshots", id]
 *   - useServiceCatalog.ts used ["service-orders", id, "labor"]
 *   - HistoryTab.tsx  used ["service-order-history", id]
 *   - useBilling.ts  used various ad-hoc strings
 *
 * All OS-detail queries should migrate to these canonical keys (Phase 2).
 * The factory follows the same pattern as `catalogKeys` in useServiceCatalog.ts.
 */

export const osKeys = {
  all: ["service-orders"] as const,
  detail: (id: string) => [...osKeys.all, id] as const,
  parts: (id: string) => [...osKeys.all, id, "parts"] as const,
  labor: (id: string) => [...osKeys.all, id, "labor"] as const,
  photos: (id: string) => [...osKeys.all, id, "photos"] as const,
  versions: (id: string) => [...osKeys.all, id, "versions"] as const,
  complement: (id: string) => [...osKeys.all, id, "complement"] as const,
  financialSummary: (id: string) => [...osKeys.all, id, "financial-summary"] as const,
  activities: (id: string) => [...osKeys.all, id, "activities"] as const,
  budgetSnapshots: (id: string) => [...osKeys.all, id, "budget-snapshots"] as const,
}
