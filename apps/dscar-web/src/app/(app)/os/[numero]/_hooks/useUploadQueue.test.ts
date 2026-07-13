import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { createElement } from "react"

// Mock apiFetch antes de importar o módulo sob teste
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from "@/lib/api"
import { useUploadQueue, validatePhotoFile } from "./useUploadQueue"

const apiFetchMock = vi.mocked(apiFetch)

// Wrapper com QueryClient fresh por teste
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
  return { Wrapper }
}

function makeFile(name = "a.jpg", type = "image/jpeg", size = 1024): File {
  const file = new File([new Uint8Array(8)], name, { type })
  Object.defineProperty(file, "size", { value: size })
  return file
}

beforeEach(() => {
  apiFetchMock.mockReset()
})

describe("validatePhotoFile", () => {
  it("aceita jpeg até 10MB", () => {
    expect(validatePhotoFile(makeFile(), "vistoria_inicial")).toBeNull()
  })
  it("recusa imagem acima de 10MB", () => {
    const big = makeFile("big.jpg", "image/jpeg", 11 * 1024 * 1024)
    expect(validatePhotoFile(big, "vistoria_inicial")).toMatch(/10MB/)
  })
  it("recusa tipo não suportado", () => {
    expect(validatePhotoFile(makeFile("a.gif", "image/gif"), "vistoria_inicial")).toMatch(
      /não suportado/,
    )
  })
  it("aceita PDF até 20MB apenas em orcamentos", () => {
    const pdf = makeFile("orc.pdf", "application/pdf", 15 * 1024 * 1024)
    expect(validatePhotoFile(pdf, "orcamentos")).toBeNull()
    expect(validatePhotoFile(pdf, "vistoria_inicial")).toMatch(/não suportado/)
  })
})

describe("useUploadQueue", () => {
  it("limita a 2 uploads simultâneos", async () => {
    const resolvers: Array<() => void> = []
    apiFetchMock.mockImplementation(
      () => new Promise((resolve) => resolvers.push(() => resolve({}))),
    )
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadQueue("os-1", "vistoria_inicial"), {
      wrapper: Wrapper,
    })
    act(() => result.current.enqueue([makeFile("1.jpg"), makeFile("2.jpg"), makeFile("3.jpg")]))

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2))
    expect(result.current.items.filter((i) => i.status === "uploading")).toHaveLength(2)
    expect(result.current.items.filter((i) => i.status === "pending")).toHaveLength(1)

    act(() => resolvers[0]())
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(3))
    act(() => {
      resolvers[1]()
      resolvers[2]()
    })
    await waitFor(() => expect(result.current.doneCount).toBe(3))
    expect(result.current.isUploading).toBe(false)
  })

  it("arquivo inválido vira error sem request", async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadQueue("os-1", "vistoria_inicial"), {
      wrapper: Wrapper,
    })
    act(() => result.current.enqueue([makeFile("a.gif", "image/gif")]))
    expect(result.current.items[0].status).toBe("error")
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it("retry reenvia item com erro", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("HTTP 500")).mockResolvedValueOnce({})
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useUploadQueue("os-1", "vistoria_inicial"), {
      wrapper: Wrapper,
    })
    act(() => result.current.enqueue([makeFile()]))
    await waitFor(() => expect(result.current.items[0].status).toBe("error"))
    act(() => result.current.retry(result.current.items[0].id))
    await waitFor(() => expect(result.current.items[0].status).toBe("done"))
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })
})
