import { describe, it, expect } from "vitest"
import { newOSSchema } from "./new-os.schema"

const baseValid = {
  customer_type: "private" as const,
  customer: "550e8400-e29b-41d4-a716-446655440000",
  customer_name: "João",
  plate: "ABC1D23",
  make: "Honda",
  model: "Civic",
}

describe("newOSSchema", () => {
  it("aceita vehicle_version opcional", () => {
    const r = newOSSchema.safeParse({ ...baseValid, vehicle_version: "EX" })
    expect(r.success).toBe(true)
  })

  it("rejeita make vazio", () => {
    const r = newOSSchema.safeParse({ ...baseValid, make: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0])
      expect(paths).toContain("make")
    }
  })

  it("rejeita model vazio", () => {
    const r = newOSSchema.safeParse({ ...baseValid, model: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0])
      expect(paths).toContain("model")
    }
  })

  it("rejeita plate com menos de 7 chars", () => {
    const r = newOSSchema.safeParse({ ...baseValid, plate: "ABC123" })
    expect(r.success).toBe(false)
  })
})
