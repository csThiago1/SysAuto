import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, ServiceOrder } from "@paddock/types";

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function useOverdueOrders() {
  return useQuery<PaginatedResponse<ServiceOrder>>({
    queryKey: ["service-orders", "overdue"],
    queryFn: () =>
      apiFetch<PaginatedResponse<ServiceOrder>>(
        `/api/proxy/service-orders/?estimated_delivery__date__lte=${todayISO()}&page_size=20&ordering=estimated_delivery`
      ),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    select: (data) => ({
      ...data,
      // Filtra client-side: remove delivered e cancelled
      results: data.results.filter(
        (o) => o.status !== "delivered" && o.status !== "cancelled"
      ),
    }),
  });
}
