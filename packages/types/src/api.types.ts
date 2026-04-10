/**
 * @paddock/types — API utilities
 * Tipos genéricos para respostas da API Django REST Framework.
 */

/** Resposta paginada padrão do DRF */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Erro de campo do DRF no formato { field: string[] } */
export type ApiFieldErrors = Record<string, string[]>;

/** Erro genérico da API */
export interface ApiErrorPayload {
  detail?: string;
  non_field_errors?: string[];
  [field: string]: string[] | string | undefined;
}
