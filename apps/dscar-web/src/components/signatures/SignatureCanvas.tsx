"use client"

import { forwardRef, useImperativeHandle, useRef } from "react"
import SignaturePad from "react-signature-canvas"

export interface SignatureCanvasHandle {
  clear: () => void
  isEmpty: () => boolean
  toPng: () => string
}

interface SignatureCanvasProps {
  className?: string
  penColor?: string
  backgroundColor?: string
  onEnd?: () => void
}

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  function SignatureCanvas(
    { className, penColor = "#0f172a", backgroundColor = "#ffffff", onEnd },
    ref,
  ) {
    const padRef = useRef<SignaturePad | null>(null)

    useImperativeHandle(ref, () => ({
      clear: () => padRef.current?.clear(),
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toPng: () => {
        const dataUrl = padRef.current?.toDataURL("image/png") ?? ""
        return dataUrl.replace(/^data:image\/png;base64,/, "")
      },
    }))

    return (
      <SignaturePad
        ref={padRef}
        penColor={penColor}
        backgroundColor={backgroundColor}
        onEnd={onEnd}
        canvasProps={{
          className: `w-full h-full rounded border border-input ${className ?? ""}`,
        }}
      />
    )
  },
)
