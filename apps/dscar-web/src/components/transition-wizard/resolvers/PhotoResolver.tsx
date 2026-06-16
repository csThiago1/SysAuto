"use client"

import { useRef, useState } from "react"
import { Camera, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useUploadPhoto } from "@/app/(app)/os/[numero]/_hooks/useOSItems"
import type { OSPhotoFolder } from "@paddock/types"
import type { ResolverProps } from "./index"
import { registerResolver } from "./index"

const CODE_TO_FOLDER: Record<string, OSPhotoFolder> = {
  PHOTOS_MIN_12: "vistoria_inicial",
  FINAL_PHOTOS_12: "vistoria_final",
  PROGRESS_PHOTO: "acompanhamento",
}

export function PhotoResolver({ block, order }: ResolverProps) {
  const folder = CODE_TO_FOLDER[block.code]
  const uploadMutation = useUploadPhoto(order.id)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [totalSelected, setTotalSelected] = useState(0)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList): Promise<void> {
    const arr = Array.from(files)
    if (arr.length === 0) return
    setTotalSelected(arr.length)
    setUploadedCount(0)
    setUploading(true)

    let ok = 0
    for (const file of arr) {
      try {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("folder", folder)
        await uploadMutation.mutateAsync(fd)
        ok++
        setUploadedCount(ok)
      } catch {
        // individual error já é tratado pelo hook com toast
      }
    }

    setUploading(false)
    if (ok > 0) {
      toast.success(`${ok} foto${ok > 1 ? "s" : ""} enviada${ok > 1 ? "s" : ""}. Verificando requisito...`)
    }
    // Não chamamos onResolved() — deixamos o refetch do useServiceOrder decidir
    // se o bloco foi satisfeito (o backend revalida a contagem)
    if (inputRef.current) inputRef.current.value = ""
    setTotalSelected(0)
    setUploadedCount(0)
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-muted-foreground">{block.message}</p>

      <div
        className="rounded-md border-2 border-dashed border-border bg-muted/20 p-4 text-center cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-1">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Enviando {uploadedCount}/{totalSelected}...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">Toque para selecionar fotos</span>
            <span className="text-xs text-muted-foreground">
              Selecione múltiplas de uma vez — câmera ou galeria
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

registerResolver(["PHOTOS_MIN_12", "FINAL_PHOTOS_12", "PROGRESS_PHOTO"], PhotoResolver)
