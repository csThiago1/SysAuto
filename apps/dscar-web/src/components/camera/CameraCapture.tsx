"use client"

/**
 * CameraCapture — captura de foto pela câmera com marca d'água.
 *
 * getUserMedia + canvas, sem dependências (spec 2026-06-22). A marca
 * d'água (data/hora, OS, usuário) é desenhada NO DEVICE antes do upload
 * — requisito de evidência pra seguradoras (fotos são imutáveis).
 *
 * iOS: playsInline obrigatório; abrir a câmera só após gesto do usuário.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, RefreshCw, X } from "lucide-react"
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
  const [preview, setPreview] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!open) {
      stopStream()
      setPreview(null)
      setPreviewBlob(null)
      setError(null)
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
        setPreviewBlob(blob)
        setPreview(URL.createObjectURL(blob))
        stopStream()
      },
      "image/jpeg",
      0.88,
    )
  }

  function confirm() {
    if (!previewBlob) return
    onCapture(new File([previewBlob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }))
    onClose()
  }

  async function retake() {
    setPreview(null)
    setPreviewBlob(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 } },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setError("Não foi possível reabrir a câmera.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4" />
            Capturar foto
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black min-h-[300px] flex items-center justify-center">
          {error ? (
            <p className="p-6 text-center text-sm text-error-400">{error}</p>
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Prévia da foto" className="max-h-[60vh] w-full object-contain" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="max-h-[60vh] w-full object-contain" />
          )}
        </div>

        <div className="flex justify-end gap-2 p-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancelar
          </Button>
          {preview ? (
            <>
              <Button variant="outline" size="sm" onClick={retake}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Tirar outra
              </Button>
              <Button size="sm" onClick={confirm}>Usar esta foto</Button>
            </>
          ) : (
            <Button size="sm" onClick={capture} disabled={!!error}>
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              Capturar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
