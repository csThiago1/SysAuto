import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";

/**
 * Período de (monthsBack + 1) meses cheios terminando no mês de `now`.
 * 0 = mês atual · 2 = trimestre · 5 = semestre · 11 = doze meses.
 * `format` usa o relógio local (Manaus), não UTC.
 */
export function getMonthRange(
  monthsBack: number,
  now: Date = new Date(),
): { start: string; end: string } {
  return {
    start: format(startOfMonth(subMonths(now, monthsBack)), "yyyy-MM-dd"),
    end: format(endOfMonth(now), "yyyy-MM-dd"),
  };
}
