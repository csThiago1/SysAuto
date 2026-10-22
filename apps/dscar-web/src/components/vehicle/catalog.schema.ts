import { z } from "zod"

export const catalogOptionSchema = z.object({
  id: z.number(),
  label: z.string(),
  logo_url: z.string().optional(),
})
export type CatalogOption = z.infer<typeof catalogOptionSchema>

/** Mesmo formato do `catalog_path` do backend. `version` é o ano/combustível da versão FIPE. */
export const catalogSelectionSchema = z.object({
  tipo: z.enum(["carro", "moto", "caminhao"]),
  make: catalogOptionSchema,
  family: catalogOptionSchema.nullable(),
  model: catalogOptionSchema.nullable(),
  version: catalogOptionSchema.nullable(),
})
export type CatalogSelection = z.infer<typeof catalogSelectionSchema>
export type VehicleTipo = CatalogSelection["tipo"]
export const VEHICLE_TIPOS: { value: VehicleTipo; label: string }[] = [
  { value: "carro", label: "Carro" },
  { value: "moto", label: "Moto" },
  { value: "caminhao", label: "Caminhão" },
]

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  })
}

const municipioSchema = z.object({ id: z.string(), label: z.string() }).nullable()

const cepFields = z.object({
  cep: z.string(),
  logradouro: z.string(),
  complemento: z.string(),
  bairro: z.string(),
  municipio: municipioSchema,
  uf: z.string(),
})

const cnpjFields = z.object({
  razao_social: z.string(),
  nome_fantasia: z.string(),
  situacao: z.string(),
  logradouro: z.string(),
  numero: z.string(),
  complemento: z.string(),
  bairro: z.string(),
  cep: z.string(),
  municipio: municipioSchema,
  uf: z.string(),
  cnae_codigo: z.string(),
  cnae_descricao: z.string(),
  simples: z.boolean().nullable(),
  mei: z.boolean().nullable(),
  email: z.string(),
  telefone: z.string(),
})

const vehicleFields = {
  vehicle: catalogSelectionSchema.nullable(),
  color: z.object({ value: z.string(), label: z.string() }).nullable(),
  year_manufacture: z.number().nullable(),
}

const placaFields = z.object({
  ...vehicleFields,
  restricao: z
    .object({ situacao: z.string(), tem_restricao: z.boolean(), consultado_em: z.string() })
    .nullable(),
})

/** `source`: "os" (OS anterior), "regra" (aprendida pelo prefixo) ou "vin" (só a montadora). */
const chassiFields = z.object({
  ...vehicleFields,
  ano_modelo: z.number().nullable(),
  confianca: z.enum(["exata", "alta"]).nullable(),
})

/** `found: false` traz `fields: {}`; é resposta normal, não erro. */
function lookupResult<F extends z.AnyZodObject>(fields: F) {
  const base = { source: z.string(), unmatched: z.array(z.string()) }
  return z.discriminatedUnion("found", [
    z.object({ found: z.literal(true), fields, ...base }),
    z.object({ found: z.literal(false), fields: z.object({}), ...base }),
  ])
}

export const lookupResultSchemas = {
  cep: lookupResult(cepFields),
  cnpj: lookupResult(cnpjFields),
  placa: lookupResult(placaFields),
  chassi: lookupResult(chassiFields),
}
export type LookupKind = keyof typeof lookupResultSchemas
export type LookupResult<K extends LookupKind> = z.infer<(typeof lookupResultSchemas)[K]>
