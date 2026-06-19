import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SignatureSheet } from "../SignatureSheet"

const captureMutate = vi.fn()
const captureMock = vi.fn(() => ({
  mutateAsync: captureMutate,
  isPending: false,
  reset: vi.fn(),
}))
vi.mock("@/hooks/useSignatureCapture", () => ({
  useSignatureCapture: () => captureMock(),
}))

// Mock SignatureCanvas — repassa onEnd e expõe handle
vi.mock("../SignatureCanvas", () => {
  const React = require("react")
  let empty = true
  const Mock = React.forwardRef(
    (props: { onEnd?: () => void }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        clear: () => { empty = true },
        isEmpty: () => empty,
        toPng: () => "BASE64",
      }))
      return (
        <button
          data-testid="draw"
          type="button"
          onClick={() => { empty = false; props.onEnd?.() }}
        >
          draw
        </button>
      )
    },
  )
  Mock.displayName = "SignatureCanvasMock"
  return { SignatureCanvas: Mock }
})

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  serviceOrderId: 42,
  documentType: "BUDGET_APPROVAL" as const,
  title: "Aprovação do orçamento",
  defaultSignerName: "João Silva",
  defaultSignerCpf: "123.456.789-00",
  onCaptured: vi.fn(),
}

describe("SignatureSheet", () => {
  beforeEach(() => {
    captureMutate.mockReset()
    baseProps.onCaptured = vi.fn()
    baseProps.onOpenChange = vi.fn()
  })

  it("mostra title no header", () => {
    wrap(<SignatureSheet {...baseProps} />)
    expect(screen.getByText(/Aprovação do orçamento/i)).toBeInTheDocument()
  })

  it("pré-preenche nome e CPF", () => {
    wrap(<SignatureSheet {...baseProps} />)
    expect(screen.getByLabelText(/nome/i)).toHaveValue("João Silva")
    expect(screen.getByLabelText(/cpf/i)).toHaveValue("123.456.789-00")
  })

  it("Confirmar fica desabilitado com canvas vazio", () => {
    wrap(<SignatureSheet {...baseProps} />)
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled()
  })

  it("Confirmar fica desabilitado com nome < 3 chars", async () => {
    const user = userEvent.setup()
    wrap(<SignatureSheet {...baseProps} defaultSignerName="" />)
    await user.click(screen.getByTestId("draw"))
    await user.type(screen.getByLabelText(/nome/i), "Jo")
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled()
  })

  it("sucesso chama onCaptured e onOpenChange(false)", async () => {
    const user = userEvent.setup()
    const onCaptured = vi.fn()
    const onOpenChange = vi.fn()
    captureMutate.mockResolvedValueOnce({ id: 1, document_type: "BUDGET_APPROVAL" })

    wrap(<SignatureSheet {...baseProps} onCaptured={onCaptured} onOpenChange={onOpenChange} />)
    await user.click(screen.getByTestId("draw"))
    await user.click(screen.getByRole("button", { name: /confirmar/i }))

    await waitFor(() => expect(onCaptured).toHaveBeenCalledTimes(1))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(captureMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        service_order_id: 42,
        document_type: "BUDGET_APPROVAL",
        signer_name: "João Silva",
        signature_png_base64: "BASE64",
      }),
    )
  })

  it("erro de rede mostra toast e mantém Sheet aberto", async () => {
    const { toast } = await import("sonner")
    const user = userEvent.setup()
    captureMutate.mockRejectedValueOnce(new Error("network_error"))

    const onOpenChange = vi.fn()
    wrap(<SignatureSheet {...baseProps} onOpenChange={onOpenChange} />)
    await user.click(screen.getByTestId("draw"))
    await user.click(screen.getByRole("button", { name: /confirmar/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
