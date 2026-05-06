"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, X } from "lucide-react"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

interface EvidenciaUploadProps {
  value: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}

export default function EvidenciaUpload({
  value,
  onChange,
  disabled,
}: EvidenciaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File | null) => {
      setError(null)
      if (!file) {
        setPreview(null)
        onChange(null)
        return
      }
      if (!file.type.startsWith("image/")) {
        setError("Apenas imagens sao permitidas.")
        return
      }
      if (file.size > MAX_SIZE) {
        setError("Arquivo excede 5 MB.")
        return
      }
      const url = URL.createObjectURL(file)
      setPreview(url)
      onChange(file)
    },
    [onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (disabled) return
      const file = e.dataTransfer.files?.[0] ?? null
      handleFile(file)
    },
    [disabled, handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click()
  }, [disabled])

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
      onChange(null)
      if (inputRef.current) inputRef.current.value = ""
    },
    [preview, onChange]
  )

  return (
    <div className="space-y-1">
      {value && preview ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Evidencia"
            className="h-24 w-24 rounded-lg object-cover border border-border"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-error-600 p-0.5 text-foreground hover:bg-error-700 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleClick()
          }}
          className={`border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-white/30 hover:bg-white/[0.02] ${
            disabled ? "opacity-40 pointer-events-none" : ""
          }`}
        >
          <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Clique ou arraste uma imagem
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">PNG, JPG, max 5 MB</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {error && (
        <p className="text-xs text-error-400">{error}</p>
      )}
    </div>
  )
}
