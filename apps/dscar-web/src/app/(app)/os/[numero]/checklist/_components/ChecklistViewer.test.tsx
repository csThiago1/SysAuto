import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactElement } from "react"

const { state, runMatch } = vi.hoisted(() => ({
  runMatch: vi.fn(),
  state: {
    id: "c1",
    body_type: "sedan",
    suggested_body_type: null,
    stops_done: {},
    finalized_at: null as string | null,
    version: 1,
    signature_status: "pendente",
    pdf_url: null,
    vehicle_color_hex: "#9a9a9a",
    customer_type: "private" as "private" | "insurer",
    items_summary: { ok: 0, attention: 0, critical: 0, pending: 0 },
    vehicle_make: null,
    vehicle_family: null,
    allow_nc_models: false,
  },
}))

// WebGL fora do jsdom: o Car3D vira um stub
vi.mock("next/dynamic", () => ({ default: () => (): ReactElement => <div data-testid="car3d" /> }))
vi.mock("@react-three/drei", () => ({ useProgress: () => ({ active: false }), useGLTF: { clear: vi.fn() } }))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }))
vi.mock("../_hooks/useEntryChecklist", () => {
  const query = (data: unknown) => () => ({ data, isLoading: false, isError: false, refetch: vi.fn() })
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, data: undefined })
  return {
    useEntryChecklist: query(state),
    useChecklistDamages: query([]),
    useBelongings: query([]),
    useChecklistHistory: query([]),
    useBudgetMatch: () => ({ ...mutation(), mutate: runMatch }),
    usePatchChecklist: mutation,
    useFinalizeChecklist: mutation,
    useReopenChecklist: mutation,
    useSignChecklist: mutation,
    useBudgetReport: mutation,
    useCreatePanelRule: mutation,
    useReturnBelonging: mutation,
  }
})

import { ChecklistViewer } from "./ChecklistViewer"

function renderViewer(): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ model: "placeholder_sedan", paintMaterials: [], panels: {} })),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChecklistViewer osId="os-1" customerName="Cliente" />
    </QueryClientProvider>,
  )
}

describe("ChecklistViewer", () => {
  beforeEach(() => {
    state.customer_type = "private"
    state.finalized_at = null
    runMatch.mockClear()
  })

  it("mostra o carro, as abas e o estado vazio de danos", async () => {
    renderViewer()

    expect(await screen.findByTestId("car3d")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Danos (0)" })).toBeInTheDocument()
    expect(screen.getByText("Nenhum dano marcado — toque numa peça do carro")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Finalizar" })).toBeInTheDocument()
  })

  it("OS de seguradora: abrir a tela não recruza; o cruzamento é pelo botão", async () => {
    state.customer_type = "insurer"
    renderViewer()

    await screen.findByTestId("car3d")
    expect(runMatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Cruzar com o orçamento" }))
    expect(runMatch).toHaveBeenCalledTimes(1)
  })

  it("checklist finalizado não oferece recruzar (a evidência está travada)", async () => {
    state.customer_type = "insurer"
    state.finalized_at = "2026-11-10T12:00:00Z"
    renderViewer()

    await screen.findByTestId("car3d")
    expect(screen.queryByRole("button", { name: "Cruzar com o orçamento" })).not.toBeInTheDocument()
    expect(runMatch).not.toHaveBeenCalled()
  })
})
