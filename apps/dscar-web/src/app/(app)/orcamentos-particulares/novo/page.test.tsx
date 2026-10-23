import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import NovoBudgetPage from "./page"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/api", async (imp) => ({
  ...(await imp<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
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
  if (url.includes("/vehicle-catalog/colors/"))
    return [
      { value: "PRETA", label: "Preta", hex: "#111111" },
      { value: "BRANCA", label: "Branca", hex: "#ffffff" },
    ]
  if (url.includes("/lookups/placa/")) return PLACA
  if (url.includes("/vehicle-catalog/makes/")) return page([{ id: 2, label: "Fiat" }])
  if (url.includes("/vehicle-catalog/families/")) return page([{ id: 20, label: "Uno" }])
  if (url.includes("/budgets/")) return { id: 55, number: "ORC-2026-000055" }
  return {}
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <NovoBudgetPage />
    </QueryClientProvider>,
  )
}

const postCall = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.find(([url, init]) => url === "/api/proxy/budgets/" && init?.method === "POST")

async function escolherCliente(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/Buscar por nome/), "Ma")
  await user.click(await screen.findByRole("button", { name: "Maria" }))
}

describe("NovoBudgetPage — veículo pelo seletor", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockImplementation(async (url) => api(String(url)) as never)
    // A busca de cliente usa fetch direto.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ results: [{ id: 7, full_name: "Maria" }] }))),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it("a placa não sobrescreve a cor nem o veículo já escolhidos", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.selectOptions(await screen.findByDisplayValue("Selecione a cor..."), "BRANCA")
    await user.click(screen.getByLabelText("Montadora"))
    await user.click(await screen.findByRole("option", { name: "Fiat" }))
    await user.click(screen.getByLabelText("Modelo"))
    await user.click(await screen.findByRole("option", { name: "Uno" }))

    await user.type(screen.getByTestId("plate-input"), "ABC1D23")
    await user.click(screen.getByRole("button", { name: "Consultar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("ROUBO/FURTO")
    expect(screen.getByDisplayValue("Branca")).toBeInTheDocument()
    expect(screen.getByLabelText("Montadora")).toHaveTextContent("Fiat")
    expect(screen.getByLabelText("Modelo")).toHaveTextContent("Uno")
  })

  it("enviar sem família mostra 'Escolha a montadora e o modelo' e não chama a API", async () => {
    const naoAchou = { found: false, fields: {}, source: "", unmatched: [] }
    vi.mocked(apiFetch).mockImplementation(
      async (url) => (String(url).includes("/lookups/placa/") ? naoAchou : api(String(url))) as never,
    )
    const user = userEvent.setup()
    renderPage()
    await escolherCliente(user)
    await user.type(screen.getByTestId("plate-input"), "ABC1D23")
    await user.tab()
    expect(await screen.findByText(/Placa não encontrada/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Criar Orçamento" }))
    expect(await screen.findByText("Escolha a montadora e o modelo.")).toBeInTheDocument()
    expect(postCall()).toBeUndefined()
  })

  it("o envio monta o payload só com os ids do catálogo", async () => {
    const user = userEvent.setup()
    renderPage()
    await escolherCliente(user)
    await user.type(screen.getByTestId("plate-input"), "ABC1D23")
    await user.tab()
    await waitFor(() => expect(screen.getByLabelText("Modelo")).toHaveTextContent("Onix Plus"))
    expect(screen.getByLabelText("Ano")).toHaveTextContent("2025 Flex")
    expect(screen.getByDisplayValue("Preta")).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText("9BWZZZ377VT004251"), "9bwzzz377vt004251")

    await user.click(screen.getByRole("button", { name: "Criar Orçamento" }))
    await waitFor(() => expect(postCall()).toBeDefined())
    expect(JSON.parse(String(postCall()?.[1]?.body))).toEqual({
      customer_id: 7,
      vehicle_plate: "ABC1D23",
      catalog_family: 10,
      catalog_version: 1000,
      vehicle_color: "PRETA",
      vehicle_year_manufacture: 2024,
      vehicle_chassis: "9BWZZZ377VT004251",
    })
  })
})
