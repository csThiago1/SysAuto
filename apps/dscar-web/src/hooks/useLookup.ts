import { useQuery } from "@tanstack/react-query"
import type { z } from "zod"

import {
  lookupResultSchemas,
  type LookupKind,
  type LookupResult,
} from "@/components/vehicle/catalog.schema"
import { apiFetch } from "@/lib/api"

// Mapeado por tipo para `schemas[kind]` sair como o schema de K (e não a união dos tipos).
const schemas: { [P in LookupKind]: z.ZodType<LookupResult<P>, z.ZodTypeDef, unknown> } =
  lookupResultSchemas

/** Consulta CEP/CNPJ/placa/chassi. Quem chama fixa `key` no blur ou no botão (debounce de 400 ms). */
export function useLookup<K extends LookupKind>(kind: K, key: string | null) {
  const schema = schemas[kind]
  return useQuery({
    queryKey: ["lookup", kind, key],
    queryFn: async () =>
      schema.parse(
        await apiFetch<unknown>(`/api/proxy/lookups/${kind}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        }),
      ),
    enabled: key !== null,
    retry: false,
    staleTime: 10 * 60_000,
  })
}
