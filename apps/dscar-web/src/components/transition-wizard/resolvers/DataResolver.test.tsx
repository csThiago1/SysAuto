import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { DataResolver } from "./DataResolver"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn().mockResolvedValue({}),
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

describe("DataResolver — VEHICLE_BASIC_DATA", () => {
  it("renderiza campos placa + montadora + modelo", () => {
    wrap(<DataResolver block={block("VEHICLE_BASIC_DATA")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/placa/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/montadora/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/modelo/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar com dados válidos", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_BASIC_DATA")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/placa/i), "ABC1234")
    await user.type(screen.getByLabelText(/montadora/i), "Fiat")
    await user.type(screen.getByLabelText(/modelo/i), "Uno")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
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
  it("renderiza input de cor quando code=VEHICLE_COLOR", () => {
    wrap(<DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/cor/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar cor", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/cor/i), "Vermelho")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })

  it("não chama onResolved com cor vazia", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_COLOR")} order={ORDER} onResolved={onResolved} />)
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
  })
})

describe("DataResolver — VEHICLE_YEAR", () => {
  it("renderiza input de ano quando code=VEHICLE_YEAR", () => {
    wrap(<DataResolver block={block("VEHICLE_YEAR")} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByLabelText(/ano/i)).toBeInTheDocument()
  })

  it("chama onResolved após salvar ano válido", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_YEAR")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/ano/i), "2023")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })

  it("não chama onResolved com ano inválido (<1900)", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(<DataResolver block={block("VEHICLE_YEAR")} order={ORDER} onResolved={onResolved} />)
    await user.type(screen.getByLabelText(/ano/i), "1899")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    expect(onResolved).not.toHaveBeenCalled()
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
    const input = screen.getByLabelText(/data de autorização/i) as HTMLInputElement
    await user.type(input, "2026-06-17T10:00")
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
    const input = screen.getByLabelText(/data de entrada/i) as HTMLInputElement
    await user.type(input, "2026-06-15T08:30")
    await user.click(screen.getByRole("button", { name: /salvar/i }))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  })
})
