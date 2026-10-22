import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import NovoColaboradorPage from "./page"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/hooks", () => ({
  useCreateEmployee: () => ({ mutate: vi.fn(), isError: false, isPending: false }),
}))

const CEP = {
  found: true,
  source: "viacep",
  unmatched: [],
  fields: {
    cep: "69050000",
    logradouro: "Avenida Eduardo Ribeiro",
    complemento: "",
    bairro: "Centro",
    municipio: { id: "1302603", label: "Manaus" },
    uf: "AM",
  },
}

// FormField não liga o label ao input por for/id; o input é irmão do label.
const field = (label: string) =>
  screen.getByText(label, { selector: "label" }).parentElement!.querySelector("input")!

describe("Admissão — CEP", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue(CEP)
  })

  it("preenche só o que está vazio e consulta por POST sem o CEP na URL", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <NovoColaboradorPage />
      </QueryClientProvider>,
    )
    const user = userEvent.setup()
    await user.type(field("Logradouro"), "Rua do usuário")
    await user.type(screen.getByPlaceholderText("69000-000"), "69050000")
    await user.tab()

    await waitFor(() => expect(field("Bairro")).toHaveValue("Centro"))
    expect(field("Logradouro")).toHaveValue("Rua do usuário")
    expect(field("Cidade")).toHaveValue("Manaus")
    expect(field("Estado")).toHaveValue("AM")
    const [url, init] = vi.mocked(apiFetch).mock.calls[0]!
    expect(String(url)).toBe("/api/proxy/lookups/cep/")
    expect(JSON.parse(String(init?.body))).toEqual({ key: "69050000" })
  })
})
