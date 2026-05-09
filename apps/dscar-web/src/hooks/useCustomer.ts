import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Customer } from "@paddock/types";

export function useCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: ["customers", id],
    queryFn: () => apiFetch<Customer>(`/api/proxy/customers/${id}/`),
    enabled: !!id,
  });
}
