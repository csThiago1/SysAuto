import { describe, it, expect } from "vitest"
import { serviceOrderUpdateSchema } from "./service-order.schema"

describe("serviceOrderUpdateSchema", () => {
  it("texto do veículo não vai no PATCH: o servidor deriva do catálogo", () => {
    const result = serviceOrderUpdateSchema.safeParse({
      vehicle_version: "EX 2.0",
      make: "Honda",
      year: 2020,
      fuel_type: "Flex",
      fipe_value: 1,
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({})
  })

  it("aceita o caminho do seletor e o ano de fabricação", () => {
    const catalog_selection = {
      tipo: "carro",
      make: { id: 1, label: "Chevrolet" },
      family: { id: 10, label: "Onix Plus" },
      model: null,
      version: null,
    }
    const result = serviceOrderUpdateSchema.safeParse({
      plate: "ABC1D23",
      catalog_selection,
      year_manufacture: 2024,
    })
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ plate: "ABC1D23", catalog_selection, year_manufacture: 2024 })
  })
})
