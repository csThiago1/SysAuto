import { z } from "zod"

export const FORM_FIELDS = ["full_name", "email", "cpf", "phone", "password", "confirm", "cnh"] as const
export type FormField = (typeof FORM_FIELDS)[number]
export type Errors = Partial<Record<FormField | "detail", string>>

const GENERIC = "Não foi possível concluir o cadastro. Tente novamente."
const bodySchema = z.record(z.string(), z.union([z.array(z.string()), z.string()]))

export function isFormField(key: string): key is FormField {
  return (FORM_FIELDS as readonly string[]).includes(key)
}

/** Erro do backend → mensagens por campo; o que a tela não mostra vira mensagem geral. */
export function toFormErrors(body: unknown): Errors {
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return { detail: GENERIC }
  const out: Errors = {}
  for (const [key, msg] of Object.entries(parsed.data)) {
    const text = Array.isArray(msg) ? msg[0] : msg
    if (isFormField(key)) out[key] = text
    else if (key === "detail") out.detail = text
  }
  if (!Object.keys(out).length) out.detail = GENERIC
  return out
}
