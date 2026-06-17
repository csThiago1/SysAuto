import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { InsurerResolver } from "./InsurerResolver"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn().mockResolvedValue({}) }))

vi.mock("@/hooks/useInsurers", () => ({
  useInsurers: (q: string) => ({
    data: q.length >= 2 ? {
      count: 1,
      next: null,
      previous: null,
      results: [
        { id: "ins-1", name: "Porto Seguro", display_name: "Porto Seguro", trade_name: "Porto", cnpj: "00", abbreviation: "PS", brand_color: "#fff", logo: null, logo_url: "", uses_cilia: false, is_active: true },
      ],
    } : undefined,
    isFetching: false,
  }),
}))

vi.mock("@tanstack/react-query", async (imp) => {
  const real = await imp<typeof import("@tanstack/react-query")>()
  return { ...real, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})

function wrap(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

const ORDER = { id: "os-1", insurer: null } as unknown as ServiceOrder
const BLOCK: ValidationBlock = { code: "INSURER_DATA", message: "Seguradora não vinculada" }

describe("InsurerResolver", () => {
  it("renderiza input de busca de seguradora", () => {
    wrap(<InsurerResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByPlaceholderText(/buscar seguradora/i)).toBeInTheDocument()
  })

  it("mostra resultados quando user digita 2+ caracteres", async () => {
    const user = userEvent.setup()
    wrap(<InsurerResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />)
    await user.type(screen.getByPlaceholderText(/buscar seguradora/i), "Po")
    expect(await screen.findByText(/Porto Seguro/)).toBeInTheDocument()
  })

  it("chama onResolved ao clicar em seguradora", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<InsurerResolver block={BLOCK} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByPlaceholderText(/buscar seguradora/i), "Po")
    await user.click(await screen.findByText(/Porto Seguro/))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})
