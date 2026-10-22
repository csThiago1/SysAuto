import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { SinespHint, usePlacaLookup } from "./PlacaLookup"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))

const ROUBO = {
  found: true,
  source: "apiplacas",
  unmatched: [],
  fields: {
    vehicle: null,
    color: null,
    year_manufacture: 2020,
    restricao: { situacao: "ROUBO/FURTO", tem_restricao: true, consultado_em: "2026-10-22" },
  },
}

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onFound = vi.fn()
  const hook = renderHook(() => usePlacaLookup(onFound), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })
  return { onFound, ...hook }
}

describe("usePlacaLookup", () => {
  it("consultar a mesma placa de novo reaplica o resultado", async () => {
    vi.mocked(apiFetch).mockResolvedValue(ROUBO)
    const { result, onFound } = setup()
    act(() => result.current.lookup("ABC1D23"))
    await waitFor(() => expect(onFound).toHaveBeenCalledTimes(1))
    act(() => result.current.lookup("ABC1D23"))
    await waitFor(() => expect(onFound).toHaveBeenCalledTimes(2))
  })

  it("reset esquece a restrição da consulta anterior", async () => {
    vi.mocked(apiFetch).mockResolvedValue(ROUBO)
    const { result } = setup()
    act(() => result.current.lookup("ABC1D23"))
    await waitFor(() => expect(result.current.restricao?.tem_restricao).toBe(true))
    act(() => result.current.reset())
    expect(result.current.restricao).toBeNull()
    expect(result.current.notFound).toBe(false)
  })
})

describe("SinespHint", () => {
  const TEXTO = "Roubo/furto: confira no app Sinesp Cidadão."

  it("só aparece depois que uma consulta de placa rodou", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ found: false, source: "none", fields: {}, unmatched: [] })
    const { result } = setup()
    const hint = render(<SinespHint searched={result.current.searched} />)
    expect(screen.queryByText(TEXTO)).toBeNull()

    act(() => result.current.lookup("ABC1D23"))
    await waitFor(() => expect(result.current.searched).toBe(true))
    hint.rerender(<SinespHint searched={result.current.searched} />)
    expect(screen.getByText(TEXTO)).toBeTruthy()

    act(() => result.current.reset())
    hint.rerender(<SinespHint searched={result.current.searched} />)
    expect(screen.queryByText(TEXTO)).toBeNull()
  })
})
