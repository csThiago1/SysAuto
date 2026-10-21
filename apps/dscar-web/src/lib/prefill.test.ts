import { act, renderHook } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { applyIfEmpty, fillEmpty } from "./prefill"

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
