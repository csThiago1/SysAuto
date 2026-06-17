import { renderHook, act } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { useWizard } from "./useWizard"
import type { ValidationBlock } from "@paddock/types"

const hard: ValidationBlock[] = [{ code: "CUSTOMER_TYPE_SET", message: "Tipo não definido" }]
const soft: ValidationBlock[] = [{ code: "PHOTOS_MIN_12", message: "Faltam fotos" }]

describe("useWizard", () => {
  it("começa com set vazio", () => {
    const { result } = renderHook(() => useWizard())
    expect(result.current.resolvedCodes.size).toBe(0)
  })

  it("isAllBlockingResolved retorna true sem blocks", () => {
    const { result } = renderHook(() => useWizard())
    expect(result.current.isAllBlockingResolved([], [])).toBe(true)
  })

  it("isAllBlockingResolved retorna false com blocks não resolvidos", () => {
    const { result } = renderHook(() => useWizard())
    expect(result.current.isAllBlockingResolved(hard, soft)).toBe(false)
  })

  it("markResolved adiciona code ao set", () => {
    const { result } = renderHook(() => useWizard())
    act(() => result.current.markResolved("CUSTOMER_TYPE_SET"))
    expect(result.current.resolvedCodes.has("CUSTOMER_TYPE_SET")).toBe(true)
  })

  it("isAllBlockingResolved retorna true quando todos resolvidos", () => {
    const { result } = renderHook(() => useWizard())
    act(() => {
      result.current.markResolved("CUSTOMER_TYPE_SET")
      result.current.markResolved("PHOTOS_MIN_12")
    })
    expect(result.current.isAllBlockingResolved(hard, soft)).toBe(true)
  })

  it("markResolved é idempotente", () => {
    const { result } = renderHook(() => useWizard())
    act(() => result.current.markResolved("CUSTOMER_TYPE_SET"))
    act(() => result.current.markResolved("CUSTOMER_TYPE_SET"))
    expect(result.current.resolvedCodes.size).toBe(1)
  })

  it("reset zera o set", () => {
    const { result } = renderHook(() => useWizard())
    act(() => result.current.markResolved("CUSTOMER_TYPE_SET"))
    act(() => result.current.reset())
    expect(result.current.resolvedCodes.size).toBe(0)
  })
})
