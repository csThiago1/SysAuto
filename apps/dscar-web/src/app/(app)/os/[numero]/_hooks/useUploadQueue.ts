"use client"

import { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { OSPhotoFolder } from "@paddock/types"
import { apiFetch } from "@/lib/api"

const API = "/api/proxy"
const CONCURRENCY = 2
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_PDF_BYTES = 20 * 1024 * 1024
// Espelha a validação do backend (views/orders.py photos POST)
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

export type UploadItemStatus = "pending" | "uploading" | "done" | "error"

export interface UploadQueueItem {
  id: string
  fileName: string
  previewUrl: string | null
  status: UploadItemStatus
  error: string | null
}

/** null = válido; string = motivo da recusa. Espelha o backend. */
export function validatePhotoFile(file: File, folder: OSPhotoFolder): string | null {
  if (folder === "orcamentos" && file.type === "application/pdf") {
    return file.size > MAX_PDF_BYTES ? "PDF excede 20MB." : null
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return `Tipo não suportado: ${file.type || "desconhecido"}.`
  }
  if (file.size > MAX_IMAGE_BYTES) return "Arquivo excede 10MB."
  return null
}

export function useUploadQueue(orderId: string, folder: OSPhotoFolder) {
  const qc = useQueryClient()
  const [items, setItems] = useState<UploadQueueItem[]>([])
  const filesRef = useRef(new Map<string, { file: File; caption: string }>())
  const queueRef = useRef<string[]>([])
  const activeRef = useRef(0)

  const patch = useCallback((id: string, p: Partial<UploadQueueItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)))
  }, [])

  const pump = useCallback((): void => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const id = queueRef.current.shift()
      if (!id) continue
      const entry = filesRef.current.get(id)
      if (!entry) continue
      activeRef.current += 1
      patch(id, { status: "uploading", error: null })
      const fd = new FormData()
      fd.append("file", entry.file)
      fd.append("folder", folder)
      if (entry.caption) fd.append("caption", entry.caption)
      void apiFetch(`${API}/service-orders/${orderId}/photos/`, { method: "POST", body: fd })
        .then(() => patch(id, { status: "done" }))
        .catch((e: unknown) =>
          patch(id, {
            status: "error",
            error: e instanceof Error ? e.message : "Falha no envio.",
          }),
        )
        .finally(() => {
          activeRef.current -= 1
          pump()
          if (activeRef.current === 0 && queueRef.current.length === 0) {
            void qc.invalidateQueries({ queryKey: ["os-photos", orderId] })
            void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
          }
        })
    }
  }, [folder, orderId, patch, qc])

  const enqueue = useCallback(
    (files: File[], caption = ""): void => {
      const newItems: UploadQueueItem[] = files.map((file) => {
        const id = crypto.randomUUID()
        const invalid = validatePhotoFile(file, folder)
        if (!invalid) {
          filesRef.current.set(id, { file, caption })
          queueRef.current.push(id)
        }
        return {
          id,
          fileName: file.name,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
          status: invalid ? "error" : "pending",
          error: invalid,
        }
      })
      setItems((prev) => [...prev, ...newItems])
      pump()
    },
    [folder, pump],
  )

  const retry = useCallback(
    (id: string): void => {
      if (!filesRef.current.has(id)) return // inválido na validação — não reenviável
      patch(id, { status: "pending", error: null })
      queueRef.current.push(id)
      pump()
    },
    [patch, pump],
  )

  const reset = useCallback((): void => {
    setItems((prev) => {
      prev.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl))
      return []
    })
    filesRef.current.clear()
    queueRef.current = []
  }, [])

  const isUploading = items.some((it) => it.status === "uploading" || it.status === "pending")
  const doneCount = items.filter((it) => it.status === "done").length

  return { items, enqueue, retry, reset, isUploading, doneCount }
}
