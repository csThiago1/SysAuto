import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form"
import { apiFetch } from "@/lib/api"
import type { NewOSInput } from "../../os/_components/new-os.schema"
import { StepPlaca } from "./StepPlaca"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))

let orders: unknown[] = []

function api(url: string): unknown {
  if (url.includes("/service-orders/?")) return { count: orders.length, results: orders }
  if (url.includes("/vehicle-catalog/colors/")) return []
  return {}
}

let form: UseFormReturn<NewOSInput>

function Harness({ customerId = null }: { customerId?: number | null }) {
  form = useForm<NewOSInput>({
    defaultValues: {
      customer_type: "private",
      customer_id: customerId,
      customer_name: customerId ? "Já escolhido" : "",
      plate: "ABC1D23",
      catalog_selection: null,
    },
  })
  return (
    <FormProvider {...form}>
      <StepPlaca />
    </FormProvider>
  )
}

function renderStep(customerId?: number | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Harness customerId={customerId} />
    </QueryClientProvider>
  )
}

const ULTIMA = {
  id: "os-9",
  number: 9,
  plate: "ABC1D23",
  status: "delivered",
  customer_person_id: 42,
  customer_name: "João da Silva",
}

describe("StepPlaca — cliente pela placa", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => api(url) as never)
  })

  it("preenche o cliente da última OS da placa", async () => {
    orders = [ULTIMA]
    renderStep()
    await waitFor(() => expect(form.getValues("customer_id")).toBe(42))
    expect(form.getValues("customer_name")).toBe("João da Silva")
  })

  it("não troca um cliente já escolhido", async () => {
    orders = [ULTIMA]
    renderStep(7)
    await waitFor(() => expect(apiFetch).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    expect(form.getValues("customer_id")).toBe(7)
  })
})
