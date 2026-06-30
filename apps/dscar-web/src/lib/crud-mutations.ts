/**
 * CRUD mutation helpers — padrão repetido em 40+ hooks.
 *
 * Cobre o caso comum: POST / PATCH / DELETE em /api/proxy/{resource}/[{id}/],
 * invalidando o query key em sucesso. Sem optimistic updates, sem toasts
 * (cada caller decide), sem erro custom.
 *
 * Quando URL path != query key, passe `invalidateKey` explicitamente.
 * Hooks com FormData, mensagens custom, ou invalidações múltiplas
 * continuam à mão.
 */
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";

const JSON_HEADERS = { "Content-Type": "application/json" };

type Id = string | number;

interface Options {
  /** Override do query key invalidado em sucesso. Default: [resource]. */
  invalidateKey?: QueryKey;
}

function resolveKey(resource: string, opts?: Options): QueryKey {
  return opts?.invalidateKey ?? [resource];
}

export function useCreate<TResponse, TPayload = unknown>(
  resource: string,
  opts?: Options,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TPayload) =>
      apiFetch<TResponse>(`/api/proxy/${resource}/`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: resolveKey(resource, opts) }),
  });
}

export function useUpdate<TResponse, TPayload = unknown>(
  resource: string,
  opts?: Options,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: Id; data: TPayload }) =>
      apiFetch<TResponse>(`/api/proxy/${resource}/${id}/`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: resolveKey(resource, opts) }),
  });
}

export function useDelete(resource: string, opts?: Options) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) =>
      apiFetch(`/api/proxy/${resource}/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: resolveKey(resource, opts) }),
  });
}
