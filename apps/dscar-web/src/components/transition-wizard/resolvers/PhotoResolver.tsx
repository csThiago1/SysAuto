"use client"

import { useRef, useState } from "react"
import { Camera, CheckCircle2, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { useUploadPhoto } from "@/app/(app)/os/[numero]/_hooks/useOSItems"
import type { OSPhotoFolder } from "@paddock/types"
import type { ResolverProps } from "./index"

const CODE_TO_FOLDER: Record<string, OSPhotoFolder> = {
  PHOTOS_MIN_12: "vistoria_inicial",
  FINAL_PHOTOS_12: "vistoria_final",
  PROGRESS_PHOTO: "acompanhamento",
}

// Mensagens do backend tipo "Fotos de vistoria: 3/12 (faltam 9)"
function parseCount(message: string): { current: number; required: number } | null {
  const match = message.match(/(\d+)\s*\/\s*(\d+)/)
  if (!match) return null
  return { current: parseInt(match[1], 10), required: parseInt(match[2], 10) }
}

export function PhotoResolver({ block, order, onResolved }: ResolverProps) {
  const folder = CODE_TO_FOLDER[block.code]
  const uploadMutation = useUploadPhoto(order.id)
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadedInSession, setUploadedInSession] = useState(0)
  const [totalSelected, setTotalSelected] = useState(0)
  const [uploading, setUploading] = useState(false)

  const counts = parseCount(block.message)
  // Para PROGRESS_PHOTO que pede 1 foto, fallback é {current: 0, required: 1}
  const backendCurrent = counts?.current ?? 0
  const required = counts?.required ?? 1
  const effectiveCount = backendCurrent + uploadedInSession
  const remaining = Math.max(0, required - effectiveCount)
  const isComplete = effectiveCount >= required

  async function handleFiles(files: FileList): Promise<void> {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setTotalSelected(arr.length)
    setUploading(true)

    let okThisBatch = 0
    for (const file of arr) {
      try {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("folder", folder)
        await uploadMutation.mutateAsync(fd)
        okThisBatch++
        setUploadedInSession((prev) => prev + 1)
      } catch {
        // erro individual já tratado pelo hook
      }
    }

    setUploading(false)
    setTotalSelected(0)

    // Refetch da OS para refletir transition_requirements atualizado
    void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
    void qc.invalidateQueries({ queryKey: ["service-orders"] })
    void qc.invalidateQueries({ queryKey: ["os-photos", order.id] })

    const newTotal = backendCurrent + uploadedInSession + okThisBatch
    if (okThisBatch > 0) {
      if (newTotal >= required) {
        toast.success(`Pronto! ${newTotal}/${required} fotos enviadas.`)
        onResolved()
      } else {
        toast.success(`${okThisBatch} foto${okThisBatch > 1 ? "s" : ""} enviada${okThisBatch > 1 ? "s" : ""}. Faltam ${required - newTotal}.`)
      }
    }
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="mt-2 space-y-2">
      {counts && (
        <div className={`flex items-center gap-1.5 text-xs font-medium ${isComplete ? "text-success-400" : "text-muted-foreground"}`}>
          {isComplete && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
          <span>
            {effectiveCount}/{required} fotos
            {remaining > 0 && ` — faltam ${remaining}`}
            {isComplete && " — completo"}
          </span>
        </div>
      )}

      <div
        className="rounded-md border-2 border-dashed border-border bg-muted/20 p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-1">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Enviando {totalSelected} foto{totalSelected > 1 ? "s" : ""}...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">Toque para selecionar fotos</span>
            <span className="text-xs text-muted-foreground">
              Múltiplas de uma vez — câmera ou galeria
            </span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) void handleFiles(e.target.files) }}
      />

      {!uploading && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          Selecionar fotos
        </Button>
      )}
    </div>
  )
}
