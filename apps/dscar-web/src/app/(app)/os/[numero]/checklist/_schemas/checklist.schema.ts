import { z } from "zod"
import {
  DAMAGE_TYPES,
  PANEL_KEYS,
  RELATIONS,
  SEVERITIES,
  type BodyType,
} from "@paddock/car-3d"

// Valores de backend/core/apps/service_orders/checklist_constants.py, espelhados em @paddock/car-3d.
// ponytail: cast só no tuple estático das constantes, nunca no dado da API
const values = <T extends string>(opts: readonly { value: T }[]) =>
  opts.map((o) => o.value) as [T, ...T[]]

const BODY_TYPES: [BodyType, ...BodyType[]] = ["hatch", "sedan", "suv", "pickup", "van"]

export const PanelKeySchema = z.enum(PANEL_KEYS)
export const DamageTypeSchema = z.enum(values(DAMAGE_TYPES))
export const SeveritySchema = z.enum(values(SEVERITIES))
export const RelationSchema = z.enum(values(RELATIONS))
export const BodyTypeSchema = z.enum(BODY_TYPES)
export const BudgetMatchSchema = z.enum(["no_orcamento", "fora_do_orcamento", "sem_orcamento"])
export const SignatureStatusSchema = z.enum(["pendente", "presencial", "remoto"])
export const StopValueSchema = z.enum(["done", "sem_dano"])

// CharField blank/null do Django: "" e null viram null
const blankToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? null : v), schema.nullable())

// O backend devolve `/api/v1/documents/{id}/download/`; no Next o caminho autenticado é o proxy
// (/api/proxy acrescenta o /api/v1), igual às telas fiscais.
const PdfUrl = z
  .string()
  .nullable()
  .transform((url) => (url?.startsWith("/api/v1/") ? `/api/proxy/${url.slice("/api/v1/".length)}` : url))

const PhotoRefSchema = z.object({ id: z.string(), url: z.string().nullable() })

export const EntryChecklistStateSchema = z.object({
  id: z.string(),
  // checklist novo vem com "" (campo em branco no model)
  body_type: blankToNull(BodyTypeSchema),
  suggested_body_type: BodyTypeSchema.nullable(),
  stops_done: z.record(z.string(), StopValueSchema),
  finalized_at: z.string().nullable(),
  version: z.number().int(),
  signature_status: SignatureStatusSchema,
  pdf_url: PdfUrl,
  vehicle_color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  // OS sem tipo de atendimento (ex.: migrada do Databox) vem null ou ""
  customer_type: blankToNull(z.enum(["insurer", "private"])),
  items_summary: z.object({
    ok: z.number().int(),
    attention: z.number().int(),
    critical: z.number().int(),
    pending: z.number().int(),
  }),
  vehicle_make: z.string().nullable(),
  vehicle_family: z.string().nullable(),
  allow_nc_models: z.boolean(),
})
export type EntryChecklistState = z.infer<typeof EntryChecklistStateSchema>

export const DamagePointSchema = z.object({ x: z.number(), y: z.number(), z: z.number() })

export const ChecklistDamageSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  panel_key: PanelKeySchema,
  damage_type: DamageTypeSchema,
  severity: SeveritySchema,
  relation: RelationSchema,
  point: DamagePointSchema.nullable(),
  notes: z.string(),
  photo_ids: z.array(z.string()),
  photos: z.array(PhotoRefSchema),
  budget_match: BudgetMatchSchema,
  matched_budget_items: z.array(z.number().int()),
  client_uuid: z.string().nullable(),
})
export type ChecklistDamage = z.infer<typeof ChecklistDamageSchema>

export const CustomerBelongingSchema = z.object({
  id: z.string(),
  description: z.string(),
  photo_id: z.string().nullable(),
  photo: PhotoRefSchema.nullable(),
  returned_at: z.string().nullable(),
  returned_by: z.string().nullable(),
  client_uuid: z.string().nullable(),
})
export type CustomerBelonging = z.infer<typeof CustomerBelongingSchema>

/** POST …/checklist/budget-match/ — `outside` são os nomes das peças fora do orçamento. */
export const MatchSummarySchema = z.object({
  inside: z.number().int(),
  outside: z.array(z.string()),
  unmapped: z.array(z.object({ item_id: z.number().int(), description: z.string() })),
})
export type MatchSummary = z.infer<typeof MatchSummarySchema>

export const RemoteLinkSchema = z.object({ url: z.string(), whatsapp_url: z.string() })
export type RemoteLink = z.infer<typeof RemoteLinkSchema>

export const PdfUrlSchema = z.object({ pdf_url: PdfUrl })

export const ChecklistHistoryEntrySchema = z.object({
  os_number: z.number().int(),
  finalized_at: z.string().nullable(),
  pdf_url: PdfUrl,
  damage_count: z.number().int(),
})
export type ChecklistHistoryEntry = z.infer<typeof ChecklistHistoryEntrySchema>

export const BudgetPanelRuleSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  panel_keys: z.array(PanelKeySchema),
  source: z.enum(["seed", "manual"]),
})
export type BudgetPanelRule = z.infer<typeof BudgetPanelRuleSchema>
