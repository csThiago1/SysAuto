import { QueryClient } from "@tanstack/react-query";

let client: QueryClient;

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,   // 30s — evita refetch em navegação rápida
          gcTime:    5 * 60_000, // 5min — mantém cache entre páginas
          retry: 1,
        },
      },
    });
  }
  return client;
}
