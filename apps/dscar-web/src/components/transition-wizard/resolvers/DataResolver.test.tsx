import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, it, expect, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { DataResolver } from "./DataResolver"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"
import { apiFetch } from "@/lib/api"

const page = (results: { id: number; label: string }[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
})

const CATALOG: Record<string, { id: number; label: string }> = {
  makes: { id: 1, label: "Chevrolet" },
  families: { id: 10, label: "Onix Plus" },
  models: { id: 100, label: "Onix Plus Premier 1.0 Turbo" },
  years: { id: 1000, label: "2025 Flex" },
}

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn((url: string) => {
    if (url.includes("/vehicle-catalog/colors/")) {
      return Promise.resolve([
        { value: "PRETA", label: "Preta", hex: "#111111" },
        { value: "NAO_INFORMADA", label: "Não informada", hex: "" },
      ])
    }
    const level = Object.keys(CATALOG).find((l) => url.includes(`/vehicle-catalog/${l}/`))
    return Promise.resolve(level ? page([CATALOG[level]]) : {})
  }),
}))

vi.mock("@tanstack/react-query", async (imp) => {
  const real = await imp<typeof import("@tanstack/react-query")>()
  return {
    ...real,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  }
})

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const ORDER = {
  id: "abc-123",
  number: 42,
  plate: "",
  make: "",
  model: "",
  customer_type: null,
  mileage_out: null,
} as unknown as ServiceOrder

function block(code: string): ValidationBlock {
  return { code, message: `Bloco ${code}` }
}

const patchBodies = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => init?.method === "PATCH")
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)

async function pickVehicle(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  for (const [label, option] of [
    ["Montadora", "Chevrolet"],
    ["Modelo", "Onix Plus"],
    ["Versão", "Onix Plus Premier 1.0 Turbo"],
    ["Ano", "2025 Flex"],
  ]) {
    await user.click(screen.getByLabelText(label))
    await user.click(await screen.findByRole("option", { name: option }))
  }
}

describe("DataResolver — VEHICLE_BASIC_DATA", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockClear()
  })

  it("tem placa e o seletor, sem texto livre de montadora ou modelo", () => {
    wrap(<DataResolver block={block("VEHICLE_BASIC_DATA")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/placa/i)).toBeInTheDocument()
    expect(screen.getByLabelText("Montadora").tagName).toBe("BUTTON")
    expect(screen.getByLabelText("Modelo").tagName).toBe("BUTTON")
    expect(screen.getAllByRole("textbox")).toHaveLength(1)
  })

  it("salva placa + catalog_family + catalog_version, sem texto do veículo", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_BASIC_DATA")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/placa/i), "ABC1234")
    await pickVehicle(user)
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
    expect(patchBodies()).toEqual([{ plate: "ABC1234", catalog_family: 10, catalog_version: 1000 }])
  })

  it("não salva sem família", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_BASIC_DATA")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/placa/i), "ABC1234")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
    expect(patchBodies()).toEqual([])
  })
})

describe("DataResolver — CUSTOMER_TYPE_SET", () => {
  it("renderiza toggle particular / seguradora", () => {
    wrap(<DataResolver block={block("CUSTOMER_TYPE_SET")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByRole("button", { name: /particular/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /seguradora/i })).toBeInTheDocument()
  })

  it("chama onResolved ao selecionar um tipo", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("CUSTOMER_TYPE_SET")} order={ORDER} onResolved={onResolved} />)
    await user.click(screen.getByRole("button", { name: /particular/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})

describe("DataResolver — MILEAGE_OUT", () => {
  it("renderiza input de KM saída", () => {
    wrap(<DataResolver block={block("MILEAGE_OUT")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/km de saída/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar KM válido", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("MILEAGE_OUT")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/km de saída/i), "45000")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })

  it("não chama onResolved com KM vazio", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("MILEAGE_OUT")} order={ORDER} onResolved={onResolved} />)
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })

  it("não chama onResolved com KM negativo", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("MILEAGE_OUT")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/km de saída/i), "-1")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })
})

describe("DataResolver — VEHICLE_COLOR", () => {
  it("renderiza o select de cor sem campo de texto livre", async () => {
    const { container } = wrap(
      <DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={vi.fn()} />
    )
    expect(await screen.findByRole("option", { name: "Preta" })).toBeInTheDocument()
    expect(container.querySelector('input[type="text"]')).toBeNull()
  })

  it("escolher Preta faz PATCH com o código e chama onResolved", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={onResolved} />)
    await screen.findByRole("option", { name: "Preta" })
    await user.selectOptions(screen.getByRole("combobox"), "Preta")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/proxy/service-orders/abc-123/",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ color: "PRETA" }) })
    )
  })

  it("não chama onResolved com cor vazia", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={onResolved} />)
    await screen.findByRole("option", { name: "Preta" })
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })

  it("não aceita Não informada como cor", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={onResolved} />)
    await screen.findByRole("option", { name: "Preta" })
    await user.selectOptions(screen.getByRole("combobox"), "Não informada")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })
})

describe.each(["VEHICLE_YEAR", "FUEL_TYPE"])("DataResolver — %s", (code) => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockClear()
  })

  it("usa o seletor, sem input de ano nem de combustível", () => {
    const { container } = wrap(
      <DataResolver block={block(code)} order={ORDER} onResolved={vi.fn()} />
    )
    expect(screen.getByLabelText("Ano").tagName).toBe("BUTTON")
    expect(container.querySelector("input")).toBeNull()
    expect(screen.queryByRole("button", { name: "Flex" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Gasolina" })).toBeNull()
  })

  it("salva só catalog_family + catalog_version", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block(code)} order={ORDER} onResolved={onResolved} />)
    await pickVehicle(user)
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
    expect(patchBodies()).toEqual([{ catalog_family: 10, catalog_version: 1000 }])
  })
})

describe("DataResolver — DEDUCTIBLE_SET", () => {
  it("renderiza input de franquia", () => {
    wrap(<DataResolver block={block("DEDUCTIBLE_SET")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/franquia/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar valor válido", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("DEDUCTIBLE_SET")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/franquia/i), "1500.50")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })

  it("não chama onResolved com valor inválido (zero)", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("DEDUCTIBLE_SET")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/franquia/i), "0")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })
})

describe("DataResolver — CASUALTY_NUMBER", () => {
  it("renderiza input do número de sinistro", () => {
    wrap(<DataResolver block={block("CASUALTY_NUMBER")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/sinistro/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar número", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("CASUALTY_NUMBER")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/sinistro/i), "SIN-12345")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})

describe("DataResolver — AUTH_DATE_SET", () => {
  it("renderiza input datetime de autorização", () => {
    wrap(<DataResolver block={block("AUTH_DATE_SET")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/data de autorização/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar data", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("AUTH_DATE_SET")} order={ORDER} onResolved={onResolved} />)
    // O campo virou DateField (popover proprio, nao datetime-local): a data
    // entra por clique no calendario, que e como o usuario faz.
    await user.click(screen.getByLabelText(/data de autorização/i))
    await user.click(screen.getByRole("button", { name: "Hoje" }))
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})

describe("DataResolver — ENTRY_DATE_SET", () => {
  it("renderiza input datetime de entrada", () => {
    wrap(<DataResolver block={block("ENTRY_DATE_SET")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/data de entrada/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar data", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("ENTRY_DATE_SET")} order={ORDER} onResolved={onResolved} />)
    // O campo virou DateField (popover proprio, nao datetime-local): a data
    // entra por clique no calendario, que e como o usuario faz.
    await user.click(screen.getByLabelText(/data de entrada/i))
    await user.click(screen.getByRole("button", { name: "Hoje" }))
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})
