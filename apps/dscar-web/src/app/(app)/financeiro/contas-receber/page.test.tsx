import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { todayISO } from "@paddock/utils"
import ContasReceberPage from "./page"

const titulo = (id: string, customer_name: string, amount_remaining: string, status = "open") => ({
  id,
  customer_name,
  description: `OS ${id}`,
  document_number: "",
  due_date: "2026-11-30",
  amount: "500.00",
  amount_received: "0.00",
  amount_remaining,
  status,
  origin: "OS",
  created_at: "2026-11-01T10:00:00Z",
})

const TODOS = { count: 3, results: [titulo("a", "Ana", "100.00"), titulo("b", "Bia", "200.00"), titulo("c", "Caio", "0.00", "received")] }
const BUSCA = { count: 1, results: [titulo("d", "Davi", "50.50", "overdue")] }

const batchMutate = vi.fn(
  (_payload: unknown, options?: { onSuccess?: (result: { total: string }) => void }) =>
    options?.onSuccess?.({ total: "350.50" })
)
const idle = { mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null }

vi.mock("@/hooks/useFinanceiro", () => ({
  useReceivableDocuments: (filters: Record<string, string>) => ({
    data: filters.search ? BUSCA : TODOS,
    isLoading: false,
    isError: false,
  }),
  useReceivableSummary: () => ({ data: undefined, isLoading: false }),
  useRecordReceipt: () => idle,
  useCancelReceivable: () => idle,
  useRecordReceiptsBatch: () => ({ ...idle, mutate: batchMutate }),
}))
vi.mock("@/hooks/usePermission", () => ({ usePermission: () => true }))
vi.mock("@/hooks/useDebounce", () => ({ useDebounce: (value: string) => value }))
vi.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

describe("Contas a Receber — baixa em lote", () => {
  it("guarda a seleção ao trocar a busca e envia todos os títulos de uma vez", async () => {
    const user = userEvent.setup()
    render(<ContasReceberPage />)
    const barra = () => screen.getByRole("region", { name: "Títulos selecionados" })

    // cabeçalho + os dois títulos com saldo (o recebido não tem caixa)
    expect(screen.getAllByRole("checkbox")).toHaveLength(3)
    expect(screen.queryByRole("region", { name: "Títulos selecionados" })).toBeNull()

    await user.click(screen.getByRole("checkbox", { name: /Selecionar todos/ }))
    expect(barra()).toHaveTextContent(/2 títulos · R\$\s300,00/)

    await user.type(screen.getByPlaceholderText(/Buscar cliente/), "davi")
    expect(barra()).toHaveTextContent(/2 títulos/)
    expect(screen.getByRole("checkbox", { name: /Selecionar todos/ })).toHaveAttribute("data-state", "unchecked")

    await user.click(screen.getByRole("checkbox", { name: "Selecionar título de Davi" }))
    expect(barra()).toHaveTextContent(/3 títulos · R\$\s350,50/)

    await user.click(screen.getByRole("button", { name: "Receber selecionados" }))
    await user.click(screen.getByRole("button", { name: "Receber 3 títulos" }))

    expect(batchMutate.mock.calls[0][0]).toEqual({
      document_ids: ["a", "b", "d"],
      receipt_date: todayISO(),
      payment_method: "pix",
      bank_account: undefined,
      notes: undefined,
    })
    // sucesso: fecha o diálogo e limpa a seleção
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("region", { name: "Títulos selecionados" })).toBeNull()
  })
})
