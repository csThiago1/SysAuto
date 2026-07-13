"use client"

/**
 * CameraCapture — captura sequencial de fotos pela câmera com marca d'água.
 *
 * getUserMedia + canvas, sem dependências (spec 2026-06-22). A marca
 * d'água (data/hora, OS, usuário) é desenhada NO DEVICE antes do upload
 * — requisito de evidência pra seguradoras (fotos são imutáveis).
 *
 * Fluxo sequencial: cada captura chama `onCapture` e a câmera segue aberta
 * — sem preview/confirmação. Quem encerra é o usuário no botão "Concluir".
 *
 * iOS: playsInline obrigatório; abrir a câmera só após gesto do usuário.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CameraCaptureProps {
  open: boolean
  onClose: () => void
  /** Recebe o File JPEG já com marca d'água */
  onCapture: (file: File) => void
  /** Linhas extras da marca d'água (ex: "OS #9999", "João Silva") */
  watermarkLines?: string[]
}

function drawWatermark(canvas: HTMLCanvasElement, lines: string[]) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const fontSize = Math.max(14, Math.round(canvas.width / 45))
  const pad = fontSize
  const lineHeight = fontSize * 1.4
  const all = [new Date().toLocaleString("pt-BR"), ...lines]

  ctx.font = `${fontSize}px sans-serif`
  const boxWidth = Math.max(...all.map((l) => ctx.measureText(l).width)) + pad * 2
  const boxHeight = all.length * lineHeight + pad

  ctx.fillStyle = "rgba(0,0,0,0.55)"
  ctx.fillRect(0, canvas.height - boxHeight, boxWidth, boxHeight)
  ctx.fillStyle = "#fff"
  all.forEach((line, i) => {
    ctx.fillText(line, pad, canvas.height - boxHeight + pad * 0.5 + (i + 0.8) * lineHeight - lineHeight * 0.4)
  })
}

export function CameraCapture({ open, onClose, onCapture, watermarkLines = [] }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [lastThumb, setLastThumb] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!open) {
      stopStream()
      setError(null)
      setCount(0)
      setLastThumb((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setError("Não foi possível acessar a câmera. Verifique as permissões."))
    return () => {
      cancelled = true
      stopStream()
    }
  }, [open, stopStream])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    drawWatermark(canvas, watermarkLines)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }))
        setCount((c) => c + 1)
        setLastThumb((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      },
      "image/jpeg",
      0.88,
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* flex-col + max-h em dvh: controles NUNCA saem da viewport (bug do
          botão de captura invisível em telas baixas/celular) */}
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4" />
            Capturar fotos
            {count > 0 && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {count} foto{count !== 1 ? "s" : ""}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          {error ? (
            <p className="p-6 text-center text-sm text-error-400">{error}</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full max-h-[60dvh] w-full object-contain"
            />
          )}
          {lastThumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lastThumb}
              alt="Última foto"
              className="absolute bottom-2 left-2 h-14 w-14 rounded-md border-2 border-white/70 object-cover shadow-lg"
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 p-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            {count > 0 ? "Concluir" : "Cancelar"}
          </Button>
          <button
            type="button"
            onClick={capture}
            disabled={!!error}
            aria-label="Tirar foto"
            className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-border bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90 disabled:opacity-40"
          >
            <Camera className="h-6 w-6" />
          </button>
          <div className="w-20" aria-hidden />{/* balanceia o layout — botão central */}
        </div>
      </DialogContent>
    </Dialog>
  )
}
