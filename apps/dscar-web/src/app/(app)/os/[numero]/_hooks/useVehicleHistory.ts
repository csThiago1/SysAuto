import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

interface VehicleHistoryOS {
  id: string
  number: number
  status: string
  customer_name: string
  entry_date: string | null
  delivered_at: string | null
  parts_total: string
  services_total: string
  discount_total: string
  total: number
}

interface VehicleHistorySummary {
  os_count: number
  total_spent: string
  first_visit: string | null
}

export interface VehicleHistoryResponse {
  summary: VehicleHistorySummary
  results: VehicleHistoryOS[]
}

export function useVehicleHistory(plate: string, excludeId?: string) {
  const params = new URLSearchParams({ plate })
  if (excludeId) params.set("exclude_id", excludeId)

  return useQuery<VehicleHistoryResponse>({
    queryKey: ["vehicle-history", plate, excludeId],
    queryFn: () =>
      apiFetch<VehicleHistoryResponse>(
        `/api/proxy/service-orders/vehicle-history/?${params.toString()}`
      ),
    enabled: plate.length >= 7,
  })
}
