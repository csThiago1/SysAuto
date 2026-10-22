import { act, renderHook } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { applyIfEmpty, fillEmpty, locationGroup } from "./prefill"

describe("applyIfEmpty", () => {
  it("não sobrescreve e marca dirty", () => {
    const { result } = renderHook(() =>
      useForm({ defaultValues: { color: "PRETA", chassis: "" } }),
    )
    act(() => applyIfEmpty(result.current, { color: "BRANCA", chassis: "9BW" }))
    expect(result.current.getValues()).toEqual({ color: "PRETA", chassis: "9BW" })
    expect(result.current.formState.dirtyFields).toEqual({ chassis: true })
  })

  it("NAO_INFORMADA conta como vazio", () => {
    const { result } = renderHook(() => useForm({ defaultValues: { color: "NAO_INFORMADA" } }))
    act(() => applyIfEmpty(result.current, { color: "BRANCA" }))
    expect(result.current.getValues("color")).toBe("BRANCA")
  })
})

describe("fillEmpty", () => {
  it("não sobrescreve o preenchido e preenche o vazio", () => {
    const current = { cep: "69000000", bairro: "", cidade: null as string | null }
    const out = fillEmpty(current, { cep: "01001000", bairro: "Centro", cidade: "Manaus" })
    expect(out).toEqual({ cep: "69000000", bairro: "Centro", cidade: "Manaus" })
    expect(current.bairro).toBe("") // devolve cópia, não muta
  })
})

describe("locationGroup", () => {
  const manaus = { id: "1302603", label: "Manaus" }
  it("cidade/UF já preenchidas e diferentes: não mexe no grupo", () => {
    expect(locationGroup({ city: "Manaus", state: "AM", municipio_ibge: "" }, { id: "1301902", label: "Itacoatiara" }, "AM")).toEqual({})
  })
  it("grupo vazio: preenche os três", () => {
    expect(locationGroup({ city: "", state: "", municipio_ibge: "" }, manaus, "AM")).toEqual({
      city: "Manaus", state: "AM", municipio_ibge: "1302603",
    })
  })
  it("UF escolhida à mão diferente: não mexe no grupo", () => {
    expect(locationGroup({ city: "", state: "SP", municipio_ibge: "" }, manaus, "AM")).toEqual({})
  })
  it("cidade igual sem acento/caixa e IBGE vazio: completa o IBGE", () => {
    expect(locationGroup({ city: "MANAUS", state: "am", municipio_ibge: "" }, manaus, "AM").municipio_ibge).toBe("1302603")
  })
  it("IBGE já preenchido: não mexe", () => {
    expect(locationGroup({ city: "", state: "", municipio_ibge: "1301902" }, manaus, "AM")).toEqual({})
  })
})
