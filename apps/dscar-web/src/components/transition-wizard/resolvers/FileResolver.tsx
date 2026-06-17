"use client"

import { useRef, useState } from "react"
import { FileText, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { useUploadPhoto } from "@/app/(app)/os/[numero]/_hooks/useOSItems"
import type { ResolverProps } from "./index"

export function FileResolver({ block, order, onResolved }: ResolverProps) {
  const uploadMutation = useUploadPhoto(order.id)
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList): Promise<void> {
    const file = files[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "orcamentos")
      await uploadMutation.mutateAsync(fd)
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      void qc.invalidateQueries({ queryKey: ["os-photos", order.id] })
      toast.success("PDF enviado.")
      onResolved()
    } catch {
      toast.error("Erro ao enviar PDF")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
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
            <span className="text-xs text-muted-foreground">Enviando PDF...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">Clique para escolher o arquivo</span>
            <span className="text-xs text-muted-foreground">Apenas .pdf</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        data-testid="file-input"
        onChange={(e) => { if (e.target.files) void handleFiles(e.target.files) }}
      />

      {!uploading && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          Selecionar PDF
        </Button>
      )}
    </div>
  )
}
