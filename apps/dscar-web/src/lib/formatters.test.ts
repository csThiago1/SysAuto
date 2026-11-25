import { afterEach, describe, expect, it, vi } from "vitest"
import { todayISO } from "@paddock/utils"

describe("todayISO", () => {
  const originalTZ = process.env.TZ

  afterEach(() => {
    vi.useRealTimers()
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it("usa o dia local de Manaus, não o de UTC (21h de 30/11 ainda é 30/11)", () => {
    process.env.TZ = "America/Manaus"
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-12-01T01:00:00Z"))
    expect(todayISO()).toBe("2026-11-30")
  })
})
