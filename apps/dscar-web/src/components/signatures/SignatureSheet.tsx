"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSignatureCapture } from "@/hooks/useSignatureCapture"
import { SignatureCanvas, type SignatureCanvasHandle } from "./SignatureCanvas"
import type { Signature, SignatureDocumentType } from "./types"

interface SignatureSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceOrderId: number
  documentType: SignatureDocumentType
  title: string
  defaultSignerName?: string
  defaultSignerCpf?: string
  onCaptured?: (signature: Signature) => void
}

export function SignatureSheet({
  open,
  onOpenChange,
  serviceOrderId,
  documentType,
  title,
  defaultSignerName = "",
  defaultSignerCpf = "",
  onCaptured,
}: SignatureSheetProps): React.ReactElement {
  const canvasRef = useRef<SignatureCanvasHandle>(null)
  const [signerName, setSignerName] = useState(defaultSignerName)
  const [signerCpf, setSignerCpf] = useState(defaultSignerCpf)
  const [, forceRender] = useState(0)
  const capture = useSignatureCapture()

  useEffect(() => {
    if (open) {
      setSignerName(defaultSignerName)
      setSignerCpf(defaultSignerCpf)
    }
  }, [open, defaultSignerName, defaultSignerCpf])

  const nameOk = signerName.trim().length >= 3
  const canSubmit = nameOk && !(canvasRef.current?.isEmpty() ?? true) && !capture.isPending

  async function handleConfirm(): Promise<void> {
    if (!canvasRef.current) return
    if (canvasRef.current.isEmpty()) return
    try {
      const sig = await capture.mutateAsync({
        service_order_id: serviceOrderId,
        document_type: documentType,
        signer_name: signerName.trim(),
        signer_cpf: signerCpf.trim() || undefined,
        signature_png_base64: canvasRef.current.toPng(),
      })
      toast.success("Assinatura registrada.")
      onCaptured?.(sig)
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar assinatura. Tente novamente.")
    }
  }

  function handleOpenChange(next: boolean): void {
    if (!next && !canvasRef.current?.isEmpty()) {
      const ok = window.confirm("Descartar assinatura?")
      if (!ok) return
    }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-screen sm:max-w-none h-screen flex flex-col gap-4"
      >
        <SheetHeader>
          <SheetTitle>Assinatura — {title}</SheetTitle>
          <SheetDescription>
            O cliente assina abaixo. Nome e CPF podem ser ajustados se necessário.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="signer_name">Nome de quem assina</Label>
            <Input
              id="signer_name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              minLength={3}
              required
            />
          </div>
          <div>
            <Label htmlFor="signer_cpf">CPF (opcional)</Label>
            <Input
              id="signer_cpf"
              value={signerCpf}
              onChange={(e) => setSignerCpf(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-[40vh]">
          <SignatureCanvas
            ref={canvasRef}
            className="bg-white"
            onEnd={() => forceRender((n) => n + 1)}
          />
        </div>

        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              canvasRef.current?.clear()
              forceRender((n) => n + 1)
            }}
          >
            Limpar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {capture.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
