import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { FileResolver } from "./FileResolver"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"

const mockMutateAsync = vi.fn().mockResolvedValue({})

vi.mock("@/app/(app)/os/[numero]/_hooks/useOSItems", () => ({
  useUploadPhoto: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}))

vi.mock("@tanstack/react-query", async (imp) => {
  const real = await imp<typeof import("@tanstack/react-query")>()
  return { ...real, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }
})

function wrap(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

const ORDER = { id: "os-1" } as unknown as ServiceOrder
const BLOCK: ValidationBlock = { code: "BUDGET_PDF_INSURER", message: "PDF do orçamento não enviado" }

describe("FileResolver", () => {
  it("renderiza zona de upload com instrução de PDF", () => {
    wrap(<FileResolver block={BLOCK} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByText(/selecionar pdf/i)).toBeInTheDocument()
  })

  it("chama mutateAsync e onResolved após upload de PDF", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    mockMutateAsync.mockClear()
    wrap(<FileResolver block={BLOCK} order={ORDER} onResolved={onResolved} />)

    const file = new File(["pdf-content"], "orcamento.pdf", { type: "application/pdf" })
    const input = screen.getByTestId("file-input") as HTMLInputElement
    await user.upload(input, file)

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))

    const fd = mockMutateAsync.mock.calls[0][0] as FormData
    expect(fd.get("folder")).toBe("orcamentos")
    expect(fd.get("file")).toBe(file)
  })
})
