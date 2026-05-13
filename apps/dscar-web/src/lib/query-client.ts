import { QueryClient } from "@tanstack/react-query"

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: "always",
      },
    },
  })
}

let browserClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return makeQueryClient()
  }
  if (!browserClient) browserClient = makeQueryClient()
  return browserClient
}
