import { QueryClient } from "@tanstack/react-query";

let client: QueryClient;

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000 },
      },
    });
  }
  return client;
}
