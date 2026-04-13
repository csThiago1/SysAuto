import { z } from "zod"

// ─── Helpers de pré-processamento ────────────────────────────────────────────
// Converte "" / null / undefined → null (campos string opcionais)
const toNullStr = (v: unknown) =>
  v === "" || v === null || v === undefined ? null : v

// Converte NaN / "" / null / undefined → null (campos numéricos opcionais)
const toNullNum = (v: unknown) =>
  v === "" || v === null || v === undefined || (typeof v === "number" && isNaN(v))
    ? null
    : v

// Converte "" → null (campos enum opcionais)
const toNullEnum = (v: unknown) => (v === "" ? null : v)

// ─── Campos reutilizáveis ─────────────────────────────────────────────────────
// Aceita "YYYY-MM-DDTHH:mm" (datetime-local), ISO com Z e ISO com offset (+00:00)
// { local: true, offset: true } — Zod 3.25+: rejeita +00:00 sem offset: true
const datetimeField = z.preprocess(
  toNullStr,
  z.string().datetime({ local: true, offset: true, message: "Data/hora inválida" }).nullish()
)

const dateField = z.preprocess(
  toNullStr,
  z.string().date("Data inválida").nullish()
)

// ─── Schema base ─────────────────────────────────────────────────────────────
const serviceOrderBaseSchema = z.object({
  consultant_id: z.preprocess(
    toNullStr,
    z.string().uuid("Consultor inválido").nullish()
  ),
  customer_type: z.enum(["insurer", "private"]),
  os_type: z.preprocess(
    toNullEnum,
    z.enum(["bodywork", "warranty", "rework", "mechanical", "aesthetic"]).nullish()
  ),

  // Seguradora
  insurer: z.preprocess(toNullStr, z.string().uuid("Seguradora inválida").nullish()),
  insured_type: z.preprocess(
    toNullEnum,
    z.enum(["insured", "third"]).nullish()
  ),
  casualty_number: z.string().max(50).optional().default(""),
  deductible_amount: z.preprocess(
    toNullNum,
    z.number().nonnegative("Franquia não pode ser negativa").nullish()
  ),
  broker_name: z.string().max(200).optional().default(""),
  expert: z.preprocess(toNullStr, z.string().uuid("Perito inválido").nullish()),
  expert_date: dateField,
  survey_date: dateField,

  // Particular
  quotation_date: dateField,

  // Compartilhado
  authorization_date: datetimeField,

  // Cliente e veículo
  customer: z.preprocess(toNullStr, z.string().uuid("Cliente inválido").nullish()),
  customer_name: z.string().min(1, "Nome do cliente é obrigatório"),
  plate: z.string().min(7, "Placa inválida — mínimo 7 caracteres").max(8, "Placa inválida"),
  make: z.string().optional().default(""),
  model: z.string().optional().default(""),
  vehicle_version: z.string().optional().default(""),
  year: z.preprocess(
    toNullNum,
    z.number().int().min(1900, "Ano inválido").max(2100, "Ano inválido").nullish()
  ),
  color: z.string().optional().default(""),
  chassis: z.string().max(17, "Chassi inválido — máximo 17 caracteres").optional().default(""),
  fuel_type: z.string().optional().default(""),
  fipe_value: z.preprocess(
    toNullNum,
    z.number().nonnegative("Valor FIPE não pode ser negativo").nullish()
  ),
  mileage_in: z.preprocess(
    toNullNum,
    z.number().int().nonnegative("KM de entrada não pode ser negativo").nullish()
  ),

  // Entrada
  vehicle_location: z.enum(["in_transit", "workshop"]).default("workshop"),
  entry_date: datetimeField,
  service_authorization_date: datetimeField,

  // Agendamento
  scheduling_date: datetimeField,
  repair_days: z.preprocess(
    toNullNum,
    z.number().int().positive("Dias de reparo deve ser maior que zero").nullish()
  ),
  estimated_delivery_date: dateField,
  delivery_date: datetimeField,

  // Vistoria final
  final_survey_date: datetimeField,
  client_delivery_date: datetimeField,
})

export const serviceOrderCreateSchema = serviceOrderBaseSchema.refine(
  (data) => {
    if (data.customer_type === "insurer") {
      return !!data.insurer && !!data.insured_type
    }
    return true
  },
  {
    message: "Seguradora e tipo de segurado são obrigatórios para OS de seguradora",
    path: ["insurer"],
  }
)

export type ServiceOrderCreateInput = z.infer<typeof serviceOrderCreateSchema>

export const serviceOrderUpdateSchema = serviceOrderBaseSchema.partial()
export type ServiceOrderUpdateInput = z.infer<typeof serviceOrderUpdateSchema>
