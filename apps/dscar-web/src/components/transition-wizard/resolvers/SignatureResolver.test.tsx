import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SignatureResolver } from "./SignatureResolver"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"

// Mock do hook de pré-existência — controlado por test
let existsState: { isLoading: boolean; data: boolean | undefined } = {
  isLoading: false,
  data: false,
}
vi.mock("@/hooks/useSignatureExists", () => ({
  useSignatureExists: () => existsState,
  signatureKeys: { exists: () => ["signatures"] },
}))

// Mock useCustomer — usado pra pré-fill de CPF; resolver tolera data=undefined
vi.mock("@/hooks/useCustomer", () => ({
  useCustomer: () => ({ data: undefined, isLoading: false }),
}))

// Mock do SignatureSheet — substitui pelo botão "fire-captured" pra simular onCaptured
vi.mock("@/components/signatures/SignatureSheet", () => ({
  SignatureSheet: ({ open, onCaptured, title }: {
    open: boolean
    onCaptured?: () => void
    title: string
  }) =>
    open ? (
      <div data-testid="sheet" data-title={title}>
        <button onClick={() => onCaptured?.()}>fire-captured</button>
      </div>
    ) : null,
}))

const ORDER = {
  id: 42,
  customer_name: "João Silva",
  customer_uuid: null,
} as unknown as ServiceOrder

function wrap(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

describe("SignatureResolver", () => {
  beforeEach(() => {
    existsState = { isLoading: false, data: false }
  })

  it.each([
    ["SIGNATURE_APPROVAL", "Aprovação do orçamento"],
    ["CLIENT_SIGNATURE", "Entrega do veículo"],
  ])("mostra botão com label correto para %s", (code, label) => {
    const block: ValidationBlock = { code, message: "x" }
    wrap(<SignatureResolver block={block} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument()
  })

  it("mostra estado de loading enquanto consulta pré-existência", () => {
    existsState = { isLoading: true, data: undefined }
    wrap(
      <SignatureResolver
        block={{ code: "SIGNATURE_APPROVAL", message: "x" }}
        order={ORDER}
        onResolved={vi.fn()}
      />,
    )
    expect(screen.getByText(/verificando/i)).toBeInTheDocument()
  })

  it("chama onResolved no mount quando assinatura já existe (sem mostrar botão)", async () => {
    existsState = { isLoading: false, data: true }
    const onResolved = vi.fn()
    wrap(
      <SignatureResolver
        block={{ code: "SIGNATURE_APPROVAL", message: "x" }}
        order={ORDER}
        onResolved={onResolved}
      />,
    )
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("button", { name: /coletar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/já capturada/i)).toBeInTheDocument()
  })

  it("clicar abre Sheet e onCaptured chama onResolved", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(
      <SignatureResolver
        block={{ code: "SIGNATURE_APPROVAL", message: "x" }}
        order={ORDER}
        onResolved={onResolved}
      />,
    )
    await user.click(screen.getByRole("button", { name: /coletar/i }))
    expect(screen.getByTestId("sheet")).toHaveAttribute("data-title", "Aprovação do orçamento")
    await user.click(screen.getByRole("button", { name: /fire-captured/i }))
    expect(onResolved).toHaveBeenCalledTimes(1)
  })

  it("code desconhecido cai pro FallbackResolver", () => {
    const onResolved = vi.fn()
    wrap(
      <SignatureResolver
        block={{ code: "UNKNOWN_SIG_CODE", message: "Mensagem do fallback" }}
        order={ORDER}
        onResolved={onResolved}
      />,
    )
    expect(screen.getByText(/Mensagem do fallback/i)).toBeInTheDocument()
  })
})
