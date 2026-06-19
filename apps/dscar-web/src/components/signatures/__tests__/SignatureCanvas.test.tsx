import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { createRef } from "react"
import { SignatureCanvas, type SignatureCanvasHandle } from "../SignatureCanvas"

// Mock react-signature-canvas — estado em memória + repassa onEnd
vi.mock("react-signature-canvas", () => {
  const React = require("react")
  let empty = true
  const Mock = React.forwardRef(
    (props: { onEnd?: () => void }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        clear: () => { empty = true },
        isEmpty: () => empty,
        toDataURL: () => "data:image/png;base64,FAKE",
      }))
      return (
        <button
          data-testid="sigpad"
          type="button"
          onClick={() => {
            empty = false
            props.onEnd?.()
          }}
        >
          stroke
        </button>
      )
    },
  )
  Mock.displayName = "SignaturePadMock"
  return { default: Mock }
})

describe("SignatureCanvas", () => {
  it("renderiza o canvas", () => {
    const { getByTestId } = render(<SignatureCanvas />)
    expect(getByTestId("sigpad")).toBeInTheDocument()
  })

  it("expõe imperative handle: isEmpty inicial = true", () => {
    const ref = createRef<SignatureCanvasHandle>()
    render(<SignatureCanvas ref={ref} />)
    expect(ref.current?.isEmpty()).toBe(true)
  })

  it("clear() reseta isEmpty para true após onEnd", async () => {
    const user = (await import("@testing-library/user-event")).default.setup()
    const ref = createRef<SignatureCanvasHandle>()
    const onEnd = vi.fn()
    const { getByTestId } = render(<SignatureCanvas ref={ref} onEnd={onEnd} />)
    await user.click(getByTestId("sigpad"))
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(ref.current?.isEmpty()).toBe(false)
    ref.current?.clear()
    expect(ref.current?.isEmpty()).toBe(true)
  })

  it("toPng() retorna base64 SEM prefixo data:", () => {
    const ref = createRef<SignatureCanvasHandle>()
    render(<SignatureCanvas ref={ref} />)
    expect(ref.current?.toPng()).toBe("FAKE")
  })
})
