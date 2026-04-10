import { z } from "zod";

const PLATE_MERCOSUL = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/i;
const PLATE_ANTIGA   = /^[A-Z]{3}[0-9]{4}$/i;

export const createOSSchema = z.object({
  customer_id: z.number({ invalid_type_error: "Selecione um cliente" }).min(1, "Selecione um cliente"),
  plate: z
    .string()
    .min(7, "A placa deve ter 7 caracteres")
    .max(7, "A placa deve ter 7 caracteres")
    .refine((val) => PLATE_MERCOSUL.test(val) || PLATE_ANTIGA.test(val), {
      message: "Formato de placa inválido (Padrão Antigo: ABC1234 ou Mercosul: ABC1D23)",
    }),
  make: z.string().min(1, "Informe a marca do veículo"),
  model: z.string().min(1, "Informe o modelo do veículo"),
  color: z.string().optional(),
  year: z.coerce
    .number({ invalid_type_error: "Ano inválido", required_error: "Ano obrigatório" })
    .int()
    .min(1960, "Ano inválido")
    .max(new Date().getFullYear() + 1, "Ano inválido")
    .optional(),
  description: z.string().optional(),
});

export type CreateOSFormData = z.infer<typeof createOSSchema>;
