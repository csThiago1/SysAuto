import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, ServiceOrder } from "@paddock/types";

export function useClientOrders(customerId: string) {
  return useQuery<PaginatedResponse<ServiceOrder>>({
    queryKey: ["service-orders", "by-client", customerId],
    queryFn: () =>
      apiFetch<PaginatedResponse<ServiceOrder>>(
        `/api/proxy/service-orders/?customer_id=${customerId}&ordering=-opened_at&page_size=10`
      ),
    enabled: !!customerId,
  });
}
