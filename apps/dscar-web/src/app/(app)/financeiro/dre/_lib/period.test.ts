import { describe, expect, it } from "vitest";
import { getMonthRange } from "./period";

describe("getMonthRange", () => {
  // 17/11/2026 às 10h, relógio local
  const now = new Date(2026, 10, 17, 10, 0);

  it("mês atual começa no dia 1 do próprio mês, não do seguinte", () => {
    expect(getMonthRange(0, now)).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("trimestre, semestre e ano cobrem 3, 6 e 12 meses", () => {
    expect(getMonthRange(2, now).start).toBe("2026-09-01");
    expect(getMonthRange(5, now).start).toBe("2026-06-01");
    expect(getMonthRange(11, now).start).toBe("2025-12-01");
  });

  it("o início nunca fica depois do fim", () => {
    for (const back of [0, 2, 5, 11]) {
      const { start, end } = getMonthRange(back, now);
      expect(start <= end).toBe(true);
    }
  });

  it("dia 31 não estoura quando o mês anterior é mais curto", () => {
    expect(getMonthRange(1, new Date(2026, 2, 31, 10, 0))).toEqual({
      start: "2026-02-01",
      end: "2026-03-31",
    });
  });
});
