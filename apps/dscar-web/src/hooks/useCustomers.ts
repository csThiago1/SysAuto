import { useQuery } from "@tanstack/react-query";
import type { PaginatedResponse } from "@paddock/types";

export interface Customer {
  id: string;
  name: string;
  document_masked: string;
  phone_masked: string;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
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
