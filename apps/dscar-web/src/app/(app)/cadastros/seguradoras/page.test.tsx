import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import SeguradorasPage from "./page"

let mockRole = "ADMIN"
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: mockRole }, status: "authenticated" }),
}))
vi.mock("@/lib/api", async (imp) => ({
  ...(await imp<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}))
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const PORTO = {
  id: "3f1a2b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b",
  code: "porto",
  name: "Porto Seguro Companhia de Seguros Gerais",
  trade_name: "Porto Seguro",
  display_name: "Porto Seguro",
  cnpj: "61.198.164/0001-60",
  cnpjs: ["61198164000160"],
  abbreviation: "PS",
  brand_color: "#003DA5",
  logo: "",
  logo_url: "",
  uses_cilia: true,
  is_active: true,
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SeguradorasPage />
    </QueryClientProvider>,
  )
}

describe("Cadastros → Seguradoras", () => {
  beforeEach(() => {
    mockRole = "ADMIN"
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockImplementation(async (url) =>
      String(url).startsWith("/api/proxy/insurers/?")
        ? ({ count: 1, next: null, previous: null, results: [PORTO] } as never)
        : (PORTO as never),
    )
  })

  it("CONSULTANT só consulta: sem Nova Seguradora, Editar nem Desativar", async () => {
    mockRole = "CONSULTANT"
    renderPage()
    expect(await screen.findByText("Porto Seguro")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Nova Seguradora/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Desativar" })).not.toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith("/api/proxy/insurers/?page_size=200")
  })

  it("ADMIN desativa por PATCH is_active e pede as inativas na lista", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByRole("button", { name: /Nova Seguradora/ })).toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: "Desativar" }))
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/api/proxy/insurers/${PORTO.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      }),
    )
    expect(apiFetch).toHaveBeenCalledWith("/api/proxy/insurers/?page_size=200&include_inactive=true")
    expect(apiFetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "DELETE" }))
  })
})
