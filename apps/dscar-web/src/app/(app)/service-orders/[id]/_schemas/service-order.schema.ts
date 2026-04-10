import { z } from "zod"

const serviceOrderBaseSchema = z.object({
  consultant_id: z.string().uuid().optional().nullable(),
  customer_type: z.enum(["insurer", "private"]),
  os_type: z.enum(["bodywork", "warranty", "rework", "mechanical", "aesthetic"]).optional().nullable(),

  // Seguradora (condicional)
  insurer: z.string().uuid().optional().nullable(),
  insured_type: z.enum(["insured", "third"]).optional().nullable(),
  casualty_number: z.string().max(50).optional().default(""),
  deductible_amount: z.number().nonnegative().optional().nullable(),
  broker_name: z.string().max(200).optional().default(""),
  expert: z.string().uuid().optional().nullable(),
  expert_date: z.string().date().optional().nullable(),
  survey_date: z.string().date().optional().nullable(),

  // Particular
  quotation_date: z.string().date().optional().nullable(),

  // Compartilhado
  authorization_date: z.string().datetime().optional().nullable(),

  // Cliente e veículo
  customer: z.string().uuid().optional().nullable(),
  customer_name: z.string().min(1, "Nome do cliente é obrigatório"),
  plate: z.string().min(7, "Placa inválida").max(8),
  make: z.string().optional().default(""),
  model: z.string().optional().default(""),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  color: z.string().optional().default(""),
  chassis: z.string().max(17).optional().default(""),
  fuel_type: z.string().optional().default(""),
  fipe_value: z.number().nonnegative().optional().nullable(),
  mileage_in: z.number().int().nonnegative().optional().nullable(),

  // Entrada
  vehicle_location: z.enum(["in_transit", "workshop"]).default("workshop"),
  entry_date: z.string().datetime().optional().nullable(),
  service_authorization_date: z.string().datetime().optional().nullable(),

  // Agendamento
  scheduling_date: z.string().datetime().optional().nullable(),
  repair_days: z.number().int().positive().optional().nullable(),
  estimated_delivery_date: z.string().date().optional().nullable(),
  delivery_date: z.string().datetime().optional().nullable(),

  // Vistoria final
  final_survey_date: z.string().datetime().optional().nullable(),
  client_delivery_date: z.string().datetime().optional().nullable(),
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
