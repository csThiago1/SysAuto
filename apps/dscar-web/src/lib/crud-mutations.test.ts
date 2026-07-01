import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { createElement } from "react"

// Mock apiFetch antes de importar o módulo sob teste
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from "@/lib/api"
import { useCreate, useDelete, useUpdate } from "./crud-mutations"

interface Foo {
  id: string
  name: string
}
interface FooPayload {
  name: string
}

// Wrapper com QueryClient fresh por teste — invalidação medida via spy
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(qc, "invalidateQueries")
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
  return { Wrapper, invalidateSpy }
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset()
})

describe("useCreate", () => {
  it("faz POST em /api/proxy/{resource}/ com JSON body e Content-Type", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "1", name: "foo" } as Foo)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useCreate<Foo, FooPayload>("foos"), {
      wrapper: Wrapper,
    })
    await result.current.mutateAsync({ name: "foo" })
    expect(apiFetch).toHaveBeenCalledWith("/api/proxy/foos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "foo" }),
    })
  })

  it("invalida [resource] em sucesso por default", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "1", name: "foo" } as Foo)
    const { Wrapper, invalidateSpy } = makeWrapper()
    const { result } = renderHook(() => useCreate<Foo, FooPayload>("foos"), {
      wrapper: Wrapper,
    })
    await result.current.mutateAsync({ name: "foo" })
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["foos"] }),
    )
  })

  it("respeita invalidateKey custom quando fornecido", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "1", name: "foo" } as Foo)
    const { Wrapper, invalidateSpy } = makeWrapper()
    const { result } = renderHook(
      () =>
        useCreate<Foo, FooPayload>("nested/foos", {
          invalidateKey: ["custom", "key"],
        }),
      { wrapper: Wrapper },
    )
    await result.current.mutateAsync({ name: "foo" })
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["custom", "key"],
      }),
    )
  })
})

describe("useUpdate", () => {
  it("faz PATCH em /api/proxy/{resource}/{id}/ com id extraído do arg", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "42", name: "bar" } as Foo)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useUpdate<Foo, Partial<FooPayload>>("foos"),
      { wrapper: Wrapper },
    )
    await result.current.mutateAsync({ id: "42", data: { name: "bar" } })
    expect(apiFetch).toHaveBeenCalledWith("/api/proxy/foos/42/", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "bar" }),
    })
  })

  it("aceita id numérico", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "7", name: "x" } as Foo)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useUpdate<Foo, Partial<FooPayload>>("foos"),
      { wrapper: Wrapper },
    )
    await result.current.mutateAsync({ id: 7, data: { name: "x" } })
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/proxy/foos/7/",
      expect.any(Object),
    )
  })
})

describe("useDelete", () => {
  it("faz DELETE em /api/proxy/{resource}/{id}/ sem body", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined)
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDelete("foos"), { wrapper: Wrapper })
    await result.current.mutateAsync("99")
    expect(apiFetch).toHaveBeenCalledWith("/api/proxy/foos/99/", {
      method: "DELETE",
    })
  })

  it("invalida [resource] em sucesso", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined)
    const { Wrapper, invalidateSpy } = makeWrapper()
    const { result } = renderHook(() => useDelete("foos"), { wrapper: Wrapper })
    await result.current.mutateAsync("99")
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["foos"] }),
    )
  })
})
