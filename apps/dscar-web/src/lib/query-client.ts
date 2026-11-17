import { MutationCache, QueryClient } from "@tanstack/react-query"

function makeQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    // Toda mutação que deu certo marca o cache inteiro como velho: as telas abertas
    // rebuscam na hora e as outras ao montar. Cada hook invalidava só a própria chave,
    // e lista, kanban, dashboard e placar ficavam até 1 min mostrando o dado antigo.
    // onSettled roda depois do onSuccess do hook; cancelRefetch: false reaproveita a
    // busca que o hook já disparou em vez de cancelar e pedir de novo.
    mutationCache: new MutationCache({
      onSettled: (_data, error) => {
        if (!error) void client.invalidateQueries(undefined, { cancelRefetch: false })
      },
    }),
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
  return client
}

let browserClient: QueryClient | undefined

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return makeQueryClient()
  }
  if (!browserClient) browserClient = makeQueryClient()
  return browserClient
}
