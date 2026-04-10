import { z } from "zod"

export const newOSSchema = z
  .object({
    customer_type: z.enum(["insurer", "private"], {
      required_error: "Selecione o tipo de atendimento",
    }),
    os_type: z
      .enum(["bodywork", "warranty", "rework", "mechanical", "aesthetic"])
      .optional()
      .nullable(),

    // Seguradora (obrigatório só quando customer_type === "insurer")
    insurer: z.string().uuid().optional().nullable(),
    insured_type: z.enum(["insured", "third"]).optional().nullable(),

    // Cliente
    customer: z.string().uuid().optional().nullable(),
    customer_name: z.string().min(1, "Selecione ou cadastre um cliente"),

    // Veículo
    plate: z
      .string()
      .min(7, "Placa inválida — mínimo 7 caracteres")
      .max(8, "Placa inválida — máximo 8 caracteres")
      .regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/, "Formato de placa inválido"),
    make: z.string().optional().default(""),
    model: z.string().optional().default(""),
    year: z.preprocess(
      (v) => (v === "" || v === null || (typeof v === "number" && isNaN(v)) ? undefined : v),
      z.number().int().min(1900).max(2100).optional().nullable()
    ),
    color: z.string().optional().default(""),
  })
  .refine(
    (data) => {
      if (data.customer_type === "insurer") {
        return !!data.insurer && !!data.insured_type
      }
      return true
    },
    {
      message: "Seguradora e tipo de segurado são obrigatórios",
      path: ["insurer"],
    }
  )

export type NewOSInput = z.infer<typeof newOSSchema>
