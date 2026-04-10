/**
 * usePersons — Query de listagem/detalhe de pessoas
 * Tipos: @paddock/types · Sem labels ou constantes — use @paddock/utils
 */

import { useQuery } from "@tanstack/react-query";
import type { PaginatedResponse, Person, PersonRole } from "@paddock/types";
import { apiFetch } from "@/lib/api";

export interface UsePersonsParams {
  role?: PersonRole;
  search?: string;
  is_active?: boolean;
  page?: number;
}

export function usePersons(params?: UsePersonsParams) {
  const q = new URLSearchParams();
  if (params?.role)                      q.set("role", params.role);
  if (params?.search)                    q.set("search", params.search);
  if (params?.is_active !== undefined)   q.set("is_active", String(params.is_active));
  if (params?.page)                      q.set("page", String(params.page));

  return useQuery<PaginatedResponse<Person>>({
    queryKey: ["persons", params],
    queryFn: () => apiFetch<PaginatedResponse<Person>>(`/api/proxy/persons/?${q.toString()}`),
  });
}

export function usePerson(id: number | string | null) {
  return useQuery<Person>({
    queryKey: ["persons", id],
    queryFn: () => apiFetch<Person>(`/api/proxy/persons/${id}/`),
    enabled: id != null,
  });
}
