import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { ColorSelect } from "./ColorSelect"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))

const CORES = [
  { value: "BRANCA", label: "Branca", hex: "#F5F5F5" },
  { value: "PRETA", label: "Preta", hex: "#111111" },
  { value: "NAO_INFORMADA", label: "Não informada", hex: "" },
]

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe("ColorSelect", () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset())

  it("lista vazia não abre campo de texto livre", async () => {
    vi.mocked(apiFetch).mockResolvedValue([])
    const { container } = wrap(<ColorSelect value="" onChange={vi.fn()} />)
    expect(await screen.findByText(/nenhuma cor disponível/i)).toBeInTheDocument()
    expect(container.querySelector('input[type="text"]')).toBeNull()
  })

  it("escolher Preta chama onChange com o código do enum", async () => {
    vi.mocked(apiFetch).mockResolvedValue(CORES)
    const onChange = vi.fn()
    wrap(<ColorSelect value="" onChange={onChange} />)
    await screen.findByRole("option", { name: "Preta" })
    await userEvent.setup().selectOptions(screen.getByRole("combobox"), "Preta")
    expect(onChange).toHaveBeenCalledWith("PRETA")
  })
})
