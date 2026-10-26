import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, ServiceOrder } from "@paddock/types";

/**
 * Histórico de OS de um cliente OU de um veículo (placa).
 *
 * Exatamente um dos dois filtros deve ser informado — a query só habilita
 * quando há um deles.
 */
export interface HistoricoOrdersParams {
  customerId?: string;
  plate?: string;
}

// ponytail: teto de 200 OS. Acima disso os KPIs agregados no cliente ficam
// incompletos — trocar por endpoint com agregação no servidor se algum
// cliente/placa passar disso.
const PAGE_SIZE = 200;

export function useHistoricoOrders({ customerId, plate }: HistoricoOrdersParams) {
  const filter = customerId
    ? `customer=${encodeURIComponent(customerId)}`
    : plate
      ? `plate__iexact=${encodeURIComponent(plate)}`
      : "";

  return useQuery<PaginatedResponse<ServiceOrder>>({
    queryKey: ["service-orders", "historico", customerId ?? null, plate ?? null],
    queryFn: () =>
      apiFetch<PaginatedResponse<ServiceOrder>>(
        `/api/proxy/service-orders/?${filter}&ordering=-opened_at&page_size=${PAGE_SIZE}`
      ),
    enabled: filter !== "",
  });
}
