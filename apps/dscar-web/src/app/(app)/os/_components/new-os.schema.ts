import { z } from "zod"

import { catalogSelectionSchema } from "@/components/vehicle/catalog.schema"
import type { OSCreatePayload } from "../[numero]/_hooks/useServiceOrder"

export const newOSSchema = z
  .object({
    customer_type: z.enum(["insurer", "private"], {
      required_error: "Selecione o tipo de atendimento",
    }),
    os_type: z.preprocess(
      (v) => (v === "" ? null : v),
      z.enum(["bodywork", "warranty", "rework", "mechanical", "aesthetic"]).optional().nullable()
    ),

    // Seguradora (obrigatório só quando customer_type === "insurer")
    insurer: z.string().uuid("Seguradora inválida").optional().nullable(),
    // CNPJ da nota: um dos CNPJs da seguradora; vazio = o backend usa o principal
    insurer_cnpj: z.string().optional(),
    insured_type: z.preprocess(
      (v) => (v === "" ? null : v),
      z.enum(["insured", "third"]).optional().nullable()
    ),

    // Cliente (Person FK — inteiro)
    customer_id: z.number().int().optional().nullable(),
    customer_name: z.string().min(1, "Selecione ou cadastre um cliente"),

    // Veículo
    plate: z
      .string()
      .min(7, "Placa inválida — mínimo 7 caracteres")
      .max(8, "Placa inválida — máximo 8 caracteres")
      .regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/, "Formato de placa inválido"),
    catalog_selection: catalogSelectionSchema
      .nullable()
      .refine((s) => s?.family != null, "Escolha a montadora e o modelo."),
    year_manufacture: z.number().int().nullable().optional(),
    color: z.string().optional().default("NAO_INFORMADA"),
    chassis: z.string().max(17).optional().default(""),
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

/** O form guarda o caminho do seletor; a API recebe só os ids. */
export function toCreatePayload({ catalog_selection, ...rest }: NewOSInput): OSCreatePayload {
  return {
    ...rest,
    catalog_family: catalog_selection?.family?.id ?? null,
    catalog_version: catalog_selection?.version?.id ?? null,
  }
}
