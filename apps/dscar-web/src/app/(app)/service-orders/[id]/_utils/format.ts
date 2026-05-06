/**
 * Format utilities for Service Orders.
 *
 * `formatCurrency` from `@paddock/utils` is already a canonical BRL formatter
 * that handles number | string | null | undefined and supports compact mode.
 * Re-export it here as the single import point for all OS components.
 */
export { formatCurrency, formatDate, formatDateTime } from "@paddock/utils"
