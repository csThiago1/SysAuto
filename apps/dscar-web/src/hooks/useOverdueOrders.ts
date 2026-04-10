import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { OverdueServiceOrder } from "@paddock/types";

export function useOverdueOrders() {
  return useQuery<OverdueServiceOrder[]>({
    queryKey: ["service-orders", "overdue"],
    queryFn: () =>
      apiFetch<OverdueServiceOrder[]>("/api/proxy/service-orders/overdue/"),
    staleTime: 10 * 60_000,       // 10 min — dados de prazo não mudam segundo a segundo
    refetchInterval: false,        // Sem polling automático — invalidado por mutações
    refetchOnWindowFocus: false,   // Evita refetch desnecessário ao trocar de aba
  });
}
