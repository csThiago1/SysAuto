"use client"

/**
 * SignaturePadDialog — assinatura digital em canvas (signature_pad v5).
 *
 * Touch + pressure, exporta PNG. Redimensiona o canvas pro
 * devicePixelRatio pra traço nítido em telas retina (armadilha
 * clássica da lib). Spec 2026-06-22.
 */

import { useEffect, useRef, useState } from "react"
import SignaturePad from "signature_pad"
import { Eraser, PenLine, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SignaturePadDialogProps {
  open: boolean
  onClose: () => void
  /** Recebe o PNG da assinatura como File */
  onConfirm: (file: File) => void
  /** Ex: "Assinatura do cliente" */
  title?: string
}

export function SignaturePadDialog({
  open,
  onClose,
  onConfirm,
  title = "Assinatura",
}: SignaturePadDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (!canvas) return

    // Canvas nítido em retina: escala interna pelo DPR
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const { offsetWidth, offsetHeight } = canvas
      canvas.width = offsetWidth * ratio
      canvas.height = offsetHeight * ratio
      canvas.getContext("2d")?.scale(ratio, ratio)
      padRef.current?.clear()
      setIsEmpty(true)
    }

    const pad = new SignaturePad(canvas, {
      penColor: "#1a1a2e",
      backgroundColor: "rgba(255,255,255,1)",
    })
    pad.addEventListener("endStroke", () => setIsEmpty(pad.isEmpty()))
    padRef.current = pad

    resize()
    window.addEventListener("resize", resize)
    return () => {
      window.removeEventListener("resize", resize)
      pad.off()
      padRef.current = null
    }
  }, [open])

  function clear() {
    padRef.current?.clear()
    setIsEmpty(true)
  }

  async function confirm() {
    const pad = padRef.current
    if (!pad || pad.isEmpty()) return
    const dataUrl = pad.toDataURL("image/png")
    const blob = await (await fetch(dataUrl)).blob()
    onConfirm(new File([blob], `assinatura-${Date.now()}.png`, { type: "image/png" }))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <PenLine className="h-4 w-4" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4">
          <canvas
            ref={canvasRef}
            className="h-48 w-full touch-none rounded-lg border border-border bg-white"
            aria-label="Área de assinatura"
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Assine com o dedo ou caneta no quadro acima
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancelar
          </Button>
          <Button variant="outline" size="sm" onClick={clear} disabled={isEmpty}>
            <Eraser className="mr-1.5 h-3.5 w-3.5" />
            Limpar
          </Button>
          <Button size="sm" onClick={confirm} disabled={isEmpty}>
            Confirmar assinatura
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
