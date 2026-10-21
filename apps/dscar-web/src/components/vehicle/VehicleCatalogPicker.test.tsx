import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { CatalogSelection } from "./catalog.schema"
import { VehicleCatalogPicker } from "./VehicleCatalogPicker"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))

const page = (results: { id: number; label: string }[], next: string | null = null) => ({
  count: results.length,
  next,
  previous: null,
  results,
})

const FULL: CatalogSelection = {
  tipo: "carro",
  make: { id: 1, label: "Chevrolet" },
  family: { id: 10, label: "Onix" },
  model: { id: 100, label: "Onix LT 1.0 Turbo" },
  version: { id: 1000, label: "2024 Flex" },
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe("VehicleCatalogPicker", () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset())

  it("trocar a montadora limpa modelo, versão e ano", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      page([
        { id: 1, label: "Chevrolet" },
        { id: 2, label: "Fiat" },
      ]),
    )
    const onChange = vi.fn()
    const user = userEvent.setup()
    wrap(<VehicleCatalogPicker value={FULL} onChange={onChange} />)
    await user.click(screen.getByLabelText("Montadora"))
    await user.click(await screen.findByRole("option", { name: "Fiat" }))
    expect(onChange).toHaveBeenCalledWith({
      tipo: "carro",
      make: { id: 2, label: "Fiat" },
      family: null,
      model: null,
      version: null,
    })
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toContain("/api/proxy/vehicle-catalog/makes/?")
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toContain("tipo=carro")
  })

  it("família sem versão mostra 'Versão a confirmar'", () => {
    const { rerender } = wrap(
      <VehicleCatalogPicker value={{ ...FULL, model: null, version: null }} onChange={vi.fn()} />,
    )
    expect(screen.getByText("Versão a confirmar")).toBeInTheDocument()
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <VehicleCatalogPicker value={FULL} onChange={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.queryByText("Versão a confirmar")).toBeNull()
  })

  it("não tem campo de texto livre", () => {
    wrap(<VehicleCatalogPicker value={null} onChange={vi.fn()} sourceText="ONIX LT 1.0 T" />)
    expect(screen.queryByPlaceholderText(/Ex:/)).toBeNull()
    expect(screen.queryAllByRole("textbox")).toHaveLength(0)
    expect(screen.queryByRole("button", { name: /manual/i })).toBeNull()
    expect(screen.getByText(/Como veio da fonte:/)).toHaveTextContent("ONIX LT 1.0 T")
  })

  it("busca da versão manda o texto ao servidor", async () => {
    vi.mocked(apiFetch).mockResolvedValue(page([{ id: 100, label: "Onix LT 1.0 Turbo" }]))
    const user = userEvent.setup()
    wrap(
      <VehicleCatalogPicker value={{ ...FULL, model: null, version: null }} onChange={vi.fn()} />,
    )
    await user.click(screen.getByLabelText("Versão"))
    await user.type(screen.getByPlaceholderText(/buscar/i), "lt 1.0")
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("search=lt%201.0")),
    )
    const url = vi.mocked(apiFetch).mock.lastCall?.[0]
    expect(url).toContain("/api/proxy/vehicle-catalog/models/?")
    expect(url).toContain("familia=10")
    expect(url).toContain("page_size=50")
  })

  it("'Carregar mais' pede a próxima página", async () => {
    vi.mocked(apiFetch).mockImplementation(async (input) =>
      String(input).includes("page=2")
        ? page([{ id: 3, label: "Ford" }])
        : page([{ id: 1, label: "Chevrolet" }], "next"),
    )
    const user = userEvent.setup()
    wrap(<VehicleCatalogPicker value={null} onChange={vi.fn()} />)
    await user.click(screen.getByLabelText("Montadora"))
    await user.click(await screen.findByRole("option", { name: "Carregar mais" }))
    expect(await screen.findByRole("option", { name: "Ford" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Chevrolet" })).toBeInTheDocument()
  })
})
