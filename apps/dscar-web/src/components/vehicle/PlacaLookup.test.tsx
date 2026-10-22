import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { ChassiHint, SinespHint, useVehicleLookup } from "./PlacaLookup"

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

function setup<K extends "placa" | "chassi">(kind: K) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onFound = vi.fn()
  const hook = renderHook(() => useVehicleLookup(kind, onFound), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })
  return { onFound, ...hook }
}

describe("useVehicleLookup", () => {
  it("consultar a mesma placa de novo reaplica o resultado", async () => {
    vi.mocked(apiFetch).mockResolvedValue(ROUBO)
    const { result, onFound } = setup("placa")
    act(() => result.current.lookup("ABC1D23"))
    await waitFor(() => expect(onFound).toHaveBeenCalledTimes(1))
    act(() => result.current.lookup("ABC1D23"))
    await waitFor(() => expect(onFound).toHaveBeenCalledTimes(2))
  })

  it("reset esquece a restrição da consulta anterior", async () => {
    vi.mocked(apiFetch).mockResolvedValue(ROUBO)
    const { result } = setup("placa")
    act(() => result.current.lookup("ABC1D23"))
    await waitFor(() => expect(result.current.result?.fields.restricao?.tem_restricao).toBe(true))
    act(() => result.current.reset())
    expect(result.current.result).toBeNull()
    expect(result.current.notFound).toBe(false)
  })

  it("com 'chassi' consulta POST /lookups/chassi/ com o chassi no corpo", async () => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue({ found: false, source: "none", fields: {}, unmatched: [] })
    const { result } = setup("chassi")
    act(() => result.current.lookup("8ac907655se254082"))
    await waitFor(() => expect(result.current.notFound).toBe(true))
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch).toHaveBeenCalledWith("/api/proxy/lookups/chassi/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "8AC907655SE254082" }),
    })
  })

  it("chassi com menos de 17 caracteres ou com I/O/Q não consulta", () => {
    vi.mocked(apiFetch).mockReset()
    const { result } = setup("chassi")
    act(() => result.current.lookup("8AC907655SE25408"))
    act(() => result.current.lookup("8AC907655SE25408O"))
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

describe("ChassiHint", () => {
  const vehicle = {
    tipo: "carro" as const,
    make: { id: 3, label: "Mercedes-Benz" },
    family: null,
    model: null,
    version: null,
  }
  const fields = { vehicle, color: null, year_manufacture: null, ano_modelo: 2025, confianca: null }

  it("pela decodificação mostra montadora e ano-modelo", () => {
    render(<ChassiHint result={{ found: true, source: "vin", unmatched: [], fields }} />)
    expect(screen.getByText("Pelo chassi: Mercedes-Benz, ano-modelo 2025")).toBeTruthy()
  })

  it("regra de confiança alta pede para confirmar a versão; exata não mostra dica", () => {
    const regra = {
      found: true as const,
      source: "regra",
      unmatched: [],
      fields: { ...fields, confianca: "alta" as const },
    }
    const { rerender } = render(<ChassiHint result={regra} />)
    expect(screen.getByText("Sugerido pelo chassi — confirme a versão")).toBeTruthy()
    rerender(<ChassiHint result={{ ...regra, fields: { ...fields, confianca: "exata" } }} />)
    expect(screen.queryByText(/chassi/)).toBeNull()
  })
})

describe("SinespHint", () => {
  const TEXTO = "Roubo/furto: confira no app Sinesp Cidadão."

  it("só aparece depois que uma consulta de placa rodou", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ found: false, source: "none", fields: {}, unmatched: [] })
    const { result } = setup("placa")
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
