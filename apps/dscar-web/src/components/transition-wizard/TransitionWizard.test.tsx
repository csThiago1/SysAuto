import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TransitionWizard } from "./TransitionWizard"
import type { ServiceOrder } from "@paddock/types"

const mockOrder: Partial<ServiceOrder> = {
  id: "os-1",
  number: 42,
  status: "reception",
  plate: "",
  make: "",
  model: "",
  customer_type: null,
  mileage_out: null,
  transition_requirements: {
    initial_survey: {
      can_proceed: false,
      hard_blocks: [{ code: "CUSTOMER_TYPE_SET", message: "Tipo de OS não definido" }],
      soft_blocks: [],
      warnings: [],
      has_pending_override: false,
    },
  },
}

const mockUseServiceOrder = vi.fn(() => ({ data: mockOrder, isLoading: false }))
vi.mock("@/app/(app)/os/[numero]/_hooks/useServiceOrder", () => ({
  useServiceOrder: (...args: unknown[]) => mockUseServiceOrder(...args),
}))

const mockTransitionMutate = vi.fn().mockResolvedValue({})
vi.mock("@/hooks/useTransitionValidation", () => ({
  useTransitionWithValidation: () => ({
    mutateAsync: mockTransitionMutate,
    isPending: false,
  }),
  useRequestOverride: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}))

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn().mockResolvedValue({}) }))
vi.mock("@tanstack/react-query", async (imp) => {
  const real = await imp<typeof import("@tanstack/react-query")>()
  return { ...real, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )
}

describe("TransitionWizard", () => {
  it("mostra título com número da OS e status destino", () => {
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    expect(screen.getByText(/OS #42/)).toBeInTheDocument()
    expect(screen.getByText(/Vistoria Inicial/i)).toBeInTheDocument()
  })

  it("lista o hard block na checklist", () => {
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    expect(screen.getByText("Tipo de OS não definido")).toBeInTheDocument()
  })

  it("footer mostra 'Resolva os itens' enquanto há pendências", () => {
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    expect(screen.getByText(/resolva os itens/i)).toBeInTheDocument()
  })

  it("expandir item mostra CustomerTypeForm (botões Particular/Seguradora)", async () => {
    const user = userEvent.setup()
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={vi.fn()} onSuccess={vi.fn()} />
    )
    await user.click(screen.getByRole("button", { name: /resolver aqui/i }))
    expect(screen.getByRole("button", { name: /particular/i })).toBeInTheDocument()
  })

  it("chama onClose ao clicar no X do dialog", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    wrap(
      <TransitionWizard orderId="os-1" target="initial_survey" onClose={onClose} onSuccess={vi.fn()} />
    )
    // o Dialog customizado usa aria-label/sr-only "Fechar" (PT-BR)
    const closeBtn = screen.getByRole("button", { name: /fechar/i })
    await user.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe("TransitionWizard — cancelamento com justificativa", () => {
  it("injeta justification no payload quando target=cancelled", async () => {
    mockTransitionMutate.mockClear()

    const cancelOrder = {
      id: "os-c",
      number: 99,
      status: "reception",
      transition_requirements: {
        cancelled: {
          can_proceed: false,
          hard_blocks: [{ code: "CANCEL_JUSTIFICATION", message: "Justificativa obrigatória" }],
          soft_blocks: [],
          warnings: [],
          has_pending_override: false,
        },
      },
    }
    mockUseServiceOrder.mockReturnValueOnce({ data: cancelOrder, isLoading: false })

    const user = userEvent.setup()
    wrap(<TransitionWizard orderId="os-c" target="cancelled" onClose={vi.fn()} onSuccess={vi.fn()} />)

    // Expande o resolver clicando em "Resolver aqui"
    await user.click(await screen.findByRole("button", { name: /resolver aqui/i }))

    // Preenche justificativa via fireEvent.change para definir o valor completo de uma vez
    const textarea = await screen.findByRole("textbox", { name: /motivo do cancelamento/i })
    fireEvent.change(textarea, { target: { value: "Cliente desistiu do serviço" } })

    // Clica em Avançar (label exato pode variar conforme SERVICE_ORDER_STATUS_CONFIG.cancelled.label)
    const advanceBtn = await screen.findByRole("button", { name: /avançar para/i })
    await user.click(advanceBtn)

    expect(mockTransitionMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        new_status: "cancelled",
        justification: expect.stringContaining("Cliente desistiu"),
      })
    )
  })
})
