import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ServiceOrder } from "@paddock/types"
import { apiFetch } from "@/lib/api"
import {
  serviceOrderUpdateSchema,
  type ServiceOrderUpdateInput,
} from "../../_schemas/service-order.schema"
import { buildFormDefaults } from "../../_utils/form-defaults"
import { VehicleSection } from "./VehicleSection"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))

const PLACA = {
  found: true,
  source: "apiplacas",
  unmatched: [],
  fields: {
    vehicle: {
      tipo: "carro",
      make: { id: 1, label: "Chevrolet" },
      family: { id: 10, label: "Onix Plus" },
      model: null,
      version: null,
    },
    color: { value: "PRETA", label: "Preta" },
    year_manufacture: 2024,
    restricao: null,
  },
}

function api(url: string): unknown {
  if (url.includes("/vehicle-catalog/colors/")) return [{ value: "PRETA", label: "Preta", hex: "#111111" }]
  if (url.includes("/lookups/placa/")) return PLACA
  if (url.includes("/vehicle-history/")) return { summary: { os_count: 0 }, results: [] }
  return {}
}

const ORDER = {
  id: "os-1",
  plate: "",
  customer_type: "private",
  customer_name: "Maria",
  color: "",
  chassis: "",
  catalog_family: null,
  catalog_version: null,
  catalog_path: null,
  vehicle_source_text: "ONIX LT 1.0",
  year_manufacture: null,
  fuel_type: "Flex",
  fipe_value: "98765.00",
} as unknown as ServiceOrder

let form: UseFormReturn<ServiceOrderUpdateInput>

function Harness() {
  form = useForm<ServiceOrderUpdateInput>({
    resolver: zodResolver(serviceOrderUpdateSchema),
    defaultValues: buildFormDefaults(ORDER),
  })
  return <VehicleSection form={form} order={ORDER} hideHeading />
}

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Harness />
    </QueryClientProvider>,
  )
}

describe("VehicleSection", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockImplementation(async (url) => api(String(url)) as never)
  })

  it("o que a placa preencheu entra nos dirtyFields", async () => {
    const user = userEvent.setup()
    renderSection()
    await user.type(screen.getByPlaceholderText("ABC-1D23"), "ABC1D23")
    await user.click(screen.getByRole("button", { name: "Consultar" }))
    await waitFor(() => expect(screen.getByLabelText("Modelo")).toHaveTextContent("Onix Plus"))
    expect(form.getValues("catalog_selection")).toEqual(PLACA.fields.vehicle)
    expect(form.getValues("color")).toBe("PRETA")
    expect(form.getValues("year_manufacture")).toBe(2024)
    const dirty = form.formState.dirtyFields
    expect(Object.keys(dirty).sort()).toEqual(
      ["catalog_selection", "color", "plate", "year_manufacture"].sort(),
    )
  })

  it("não existe input de combustível, de ano nem de valor FIPE", () => {
    const { container } = renderSection()
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0)
    expect(container.querySelectorAll('input[type="hidden"]')).toHaveLength(0)
    expect(screen.queryByPlaceholderText("Flex, Gasolina...")).toBeNull()
    // Só placa e chassi são digitados.
    expect(screen.getAllByRole("textbox")).toHaveLength(2)
    expect(screen.getByText("Flex")).toBeInTheDocument()
    expect(screen.getByText(/98\.765,00/)).toBeInTheDocument()
    expect(screen.getByText(/Como veio da fonte:/)).toHaveTextContent("ONIX LT 1.0")
  })
})
