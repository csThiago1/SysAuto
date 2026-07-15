import { describe, expect, it } from "vitest";
import {
  datetimeLocalToIso,
  elapsedSeconds,
  formatElapsed,
  formatHoras,
  toDatetimeLocalValue,
} from "./time";

describe("elapsedSeconds", () => {
  it("calcula decorrido a partir do ISO do servidor", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(elapsedSeconds("2026-07-15T10:17:42Z", now)).toBe(6138);
  });

  it("nunca retorna negativo (clock skew)", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(elapsedSeconds("2026-07-15T12:05:00Z", now)).toBe(0);
  });
});

describe("formatElapsed", () => {
  it("formata HH:MM:SS", () => {
    expect(formatElapsed(6138)).toBe("01:42:18");
    expect(formatElapsed(0)).toBe("00:00:00");
    expect(formatElapsed(59)).toBe("00:00:59");
  });
});

describe("formatHoras", () => {
  it("converte horas decimais pra h/min", () => {
    expect(formatHoras("1.50")).toBe("1h30");
    expect(formatHoras("2.00")).toBe("2h");
    expect(formatHoras(0.25)).toBe("0h15");
    expect(formatHoras("abc")).toBe("—");
  });
});

describe("datetime-local round-trip", () => {
  it("preserva o horário local (não desloca pro UTC)", () => {
    const date = new Date(2026, 6, 15, 14, 30); // 14:30 local
    const value = toDatetimeLocalValue(date);
    expect(value).toBe("2026-07-15T14:30");
    expect(new Date(datetimeLocalToIso(value)).getTime()).toBe(date.getTime());
  });
});
