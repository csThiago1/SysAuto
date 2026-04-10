import { QueryClient } from "@tanstack/react-query";

let client: QueryClient;

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000,            // 1 min — reduz refetches em navegação rápida
          gcTime: 10 * 60_000,          // 10 min — mantém cache entre páginas
          retry: 1,
          refetchOnWindowFocus: false,  // Principal fonte de lentidão: evita refetch ao trocar aba
          refetchOnReconnect: "always", // Reconectar = dados podem ter mudado
        },
      },
    });
  }
  return client;
}
