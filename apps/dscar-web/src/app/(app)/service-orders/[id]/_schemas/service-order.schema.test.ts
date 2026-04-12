import { describe, it, expect } from "vitest"
import { serviceOrderUpdateSchema } from "./service-order.schema"

describe("serviceOrderUpdateSchema", () => {
  it("aceita vehicle_version", () => {
    const result = serviceOrderUpdateSchema.safeParse({
      vehicle_version: "EX 2.0",
    })
    expect(result.success).toBe(true)
  })

  it("vehicle_version é opcional — parse sem ele funciona", () => {
    const result = serviceOrderUpdateSchema.safeParse({
      plate: "ABC1D23",
    })
    expect(result.success).toBe(true)
  })
})
