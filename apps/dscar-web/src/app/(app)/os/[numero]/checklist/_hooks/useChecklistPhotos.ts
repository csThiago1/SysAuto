"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { v7 as uuidv7 } from "uuid"
import { z } from "zod"

import { apiFetch } from "@/lib/api"

const API = "/api/proxy"
/** Pasta e tipo que o backend exige nas fotos de dano (resolve_photos). */
const FOLDER = "checklist_entrada"
const CHECKLIST_TYPE = "entrada"

const OSPhotoSchema = z.object({
  id: z.string(),
  folder: z.string(),
  checklist_type: z.string(),
  url: z.string().nullable(),
})
export type ChecklistPhoto = z.infer<typeof OSPhotoSchema>

export const checklistPhotosKey = (osId: string) => ["checklist-photos", osId] as const

/** Fotos da OS na pasta do checklist de entrada (as que um dano pode usar). */
export function useChecklistPhotos(osId: string) {
  return useQuery({
    queryKey: checklistPhotosKey(osId),
    queryFn: async () =>
      z
        .array(OSPhotoSchema)
        .parse(await apiFetch<unknown>(`${API}/service-orders/${osId}/photos/`))
        .filter((p) => p.folder === FOLDER && p.checklist_type === CHECKLIST_TYPE),
    enabled: !!osId,
  })
}

/** Sobe uma foto nova pelo endpoint de fotos da OS e devolve a foto criada. */
export function useUploadChecklistPhoto(osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", FOLDER)
      fd.append("checklist_type", CHECKLIST_TYPE)
      fd.append("client_uuid", uuidv7())
      // online-only: o dano precisa do id real da foto
      const data = await apiFetch<unknown>(`${API}/service-orders/${osId}/photos/`, {
        method: "POST",
        body: fd,
        offline: false,
      })
      return OSPhotoSchema.parse(data)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: checklistPhotosKey(osId) })
      void qc.invalidateQueries({ queryKey: ["os-photos", osId] })
    },
  })
}
