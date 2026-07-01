/**
 * Helpers pra consumir tipos gerados de `api.d.ts` (openapi-typescript).
 *
 * Regeneração: `make gen-api-types` na raiz do repo. Nunca editar api.d.ts
 * à mão — regenera do schema do Django.
 *
 * Uso:
 *   import type { ApiSchema } from "@/types"
 *   type Insurer = ApiSchema<"InsurerMinimal">
 *   type PaginatedInsurers = ApiSchema<"PaginatedInsurerMinimalList">
 *
 * Compat: `@paddock/types` continua funcionando pra tipos que ainda não
 * foram migrados. Migre incrementalmente — não delete o pacote antes de
 * cobrir tudo.
 */
import type { components, paths, operations } from "./api"

/** Acesso direto ao dicionário de schemas do OpenAPI. */
export type ApiSchema<K extends keyof components["schemas"]> = components["schemas"][K]

/** Dicionário completo de endpoints (raro precisar). */
export type ApiPaths = paths

/** Dicionário de operações por operationId. */
export type ApiOperations = operations
