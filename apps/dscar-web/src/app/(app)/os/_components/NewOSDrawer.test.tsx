import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { NewOSDrawer } from "./NewOSDrawer"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/api", async (imp) => ({
  ...(await imp<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}))
vi.mock("@/app/(app)/os/[numero]/_components/shared/CustomerSearch", () => ({
  CustomerSearch: ({ onChange }: { onChange: (c: { id: number; name: string }) => void }) => (
    <button type="button" onClick={() => onChange({ id: 7, name: "Maria" })}>
      Escolher cliente
    </button>
  ),
}))

const page = (results: { id: number; label: string }[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
})

const PLACA = {
  found: true,
  source: "apiplacas",
  unmatched: [],
  fields: {
    vehicle: {
      tipo: "carro",
      make: { id: 1, label: "Chevrolet" },
      family: { id: 10, label: "Onix Plus" },
      model: { id: 100, label: "ONIX SED. Plus PREM. 1.0 12V TB Flex Aut" },
      version: { id: 1000, label: "2025 Flex" },
    },
    color: { value: "PRETA", label: "Preta" },
    year_manufacture: 2024,
    restricao: { situacao: "ROUBO/FURTO", tem_restricao: true, consultado_em: "2026-10-21T10:00:00Z" },
  },
}

function api(url: string): unknown {
  if (url.includes("/vehicle-catalog/colors/")) return [{ value: "PRETA", label: "Preta", hex: "#111111" }]
  if (url.includes("/lookups/placa/")) return PLACA
  if (url.includes("/vehicle-catalog/makes/")) return page([{ id: 2, label: "Fiat" }])
  if (url.includes("/vehicle-catalog/families/")) return page([{ id: 20, label: "Uno" }])
  if (url.includes("/service-orders/")) return { id: "os-1", number: 501 }
  return {}
}

function renderDrawer() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <NewOSDrawer open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  )
}

const postCall = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.find(([url, init]) => url === "/api/proxy/service-orders/" && init?.method === "POST")

describe("NewOSDrawer — veículo pelo seletor", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockImplementation(async (url) => api(String(url)) as never)
  })

  it("enviar sem família mostra 'Escolha a montadora e o modelo'", async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(screen.getByRole("button", { name: "Escolher cliente" }))
    await user.type(screen.getByTestId("plate-input"), "ABC1D23")
    await user.click(screen.getByTestId("criar-os-btn"))
    expect(await screen.findByText("Escolha a montadora e o modelo.")).toBeInTheDocument()
    expect(postCall()).toBeUndefined()
  })

  it("placa encontrada preenche seletor e cor, alerta a restrição e envia os ids", async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.type(screen.getByTestId("plate-input"), "ABC1D23")
    expect(apiFetch).not.toHaveBeenCalledWith("/api/proxy/lookups/placa/", expect.anything())
    await user.tab()
    await waitFor(() => expect(screen.getByLabelText("Modelo")).toHaveTextContent("Onix Plus"))
    expect(screen.getByLabelText("Montadora")).toHaveTextContent("Chevrolet")
    expect(screen.getByLabelText("Ano")).toHaveTextContent("2025 Flex")
    expect(screen.getByDisplayValue("Preta")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("ROUBO/FURTO")

    await user.click(screen.getByRole("button", { name: "Escolher cliente" }))
    await user.click(screen.getByTestId("criar-os-btn"))
    await waitFor(() => expect(postCall()).toBeDefined())
    const body = JSON.parse(String(postCall()?.[1]?.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      plate: "ABC1D23",
      catalog_family: 10,
      catalog_version: 1000,
      color: "PRETA",
      year_manufacture: 2024,
      customer_id: 7,
    })
    expect(body).not.toHaveProperty("catalog_selection")
  })

  it("placa encontrada não troca uma família já escolhida", async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(screen.getByLabelText("Montadora"))
    await user.click(await screen.findByRole("option", { name: "Fiat" }))
    await user.click(screen.getByLabelText("Modelo"))
    await user.click(await screen.findByRole("option", { name: "Uno" }))

    await user.type(screen.getByTestId("plate-input"), "ABC1D23")
    await user.click(screen.getByRole("button", { name: "Consultar" }))
    await waitFor(() => expect(screen.getByDisplayValue("Preta")).toBeInTheDocument())
    expect(screen.getByLabelText("Montadora")).toHaveTextContent("Fiat")
    expect(screen.getByLabelText("Modelo")).toHaveTextContent("Uno")
  })
})
