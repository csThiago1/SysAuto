import { toast } from "sonner"
import { z } from "zod"

import { ApiError } from "@/lib/api"

export const LOCKED_MESSAGE = "Checklist finalizado — peça a um gerente para reabrir"

/** 409 `checklist_locked` (ChecklistLocked no backend). */
export function isChecklistLocked(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.body?.code === "checklist_locked"
}

export function toastChecklistError(err: unknown, fallback: string): void {
  toast.error(isChecklistLocked(err) ? LOCKED_MESSAGE : fallback)
}

const MissingSchema = z.object({ missing: z.array(z.string()) })

/** Pendências do finalize (400 `{"missing": [...]}`), ou null se o erro é outro. */
export function missingFrom(err: unknown): string[] | null {
  if (!(err instanceof ApiError) || err.status !== 400) return null
  const parsed = MissingSchema.safeParse(err.body)
  return parsed.success ? parsed.data.missing : null
}
