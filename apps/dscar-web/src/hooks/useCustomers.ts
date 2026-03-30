import { useQuery } from "@tanstack/react-query";
import type { PaginatedResponse } from "@paddock/types";
import { apiFetch } from "@/lib/api";

export interface Customer {
  id: string;
  name: string;
  document_masked: string;
  phone_masked: string;
}

export function useCustomers(
  search: string
): ReturnType<typeof useQuery<PaginatedResponse<Customer>>> {
  return useQuery<PaginatedResponse<Customer>>({
    queryKey: ["customers", search],
    queryFn: () =>
      apiFetch<PaginatedResponse<Customer>>(
        `/api/proxy/customers/?search=${encodeURIComponent(search)}`
      ),
    enabled: search.length >= 2,
  });
}
