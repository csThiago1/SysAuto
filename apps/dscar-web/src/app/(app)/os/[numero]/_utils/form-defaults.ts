/**
 * Form defaults and field labels — extracted from ServiceOrderForm.tsx
 *
 * `buildFormDefaults` is the single source of truth for converting a
 * ServiceOrder from the backend into RHF defaultValues.
 *
 * `FIELD_LABELS` maps field names to human-readable Portuguese labels used
 * in the validation error panel.
 */

import type { ServiceOrder } from "@paddock/types"
import type { ServiceOrderUpdateInput } from "../_schemas/service-order.schema"

/** Converte ISO UTC (ex: "2026-06-09T14:00:00Z") para formato local "YYYY-MM-DDTHH:mm". */
function toLocalDatetime(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso // já é local ou inválido — retorna como está
  // Se já é formato local (sem Z/offset), retorna como está
  if (!iso.includes("Z") && !iso.includes("+") && !/\d{2}:\d{2}:\d{2}[+-]/.test(iso)) {
    return iso.slice(0, 16)
  }
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export const FIELD_LABELS: Record<string, string> = {
  customer_name: "Nome do cliente",
  plate: "Placa",
  year: "Ano do veículo",
  mileage_in: "KM de entrada",
  entry_date: "Data/hora de entrada",
  service_authorization_date: "Autorização do serviço",
  scheduling_date: "Agendamento",
  authorization_date: "Data de autorização",
  delivery_date: "Data real de entrega",
  final_survey_date: "Vistoria final",
  client_delivery_date: "Entrega ao cliente",
  expert_date: "Visita do perito",
  survey_date: "Data da vistoria",
  quotation_date: "Data do orçamento",
  estimated_delivery_date: "Previsão de entrega",
  repair_days: "Dias de reparo",
  insurer: "Seguradora",
  insured_type: "Tipo de segurado",
  deductible_amount: "Franquia",
  fipe_value: "Valor FIPE",
  chassis: "Chassi",
}

/** Converte ServiceOrder do backend em defaultValues do form — única fonte de verdade. */
export function buildFormDefaults(o: ServiceOrder): ServiceOrderUpdateInput {
  return {
    consultant_id: o.consultant ?? undefined,
    customer_type: o.customer_type ?? undefined,
    os_type: o.os_type ?? undefined,
    insurer: o.insurer ?? undefined,
    insured_type: o.insured_type ?? undefined,
    casualty_number: o.casualty_number ?? "",
    deductible_amount: o.deductible_amount ? parseFloat(o.deductible_amount) : undefined,
    broker_name: o.broker_name ?? "",
    expert: o.expert ?? undefined,
    expert_date: toLocalDatetime(o.expert_date),
    survey_date: toLocalDatetime(o.survey_date),
    authorization_date: toLocalDatetime(o.authorization_date),
    quotation_date: o.quotation_date ?? undefined,
    customer: o.customer_uuid ?? undefined,
    customer_person_id: o.customer_person_id ?? undefined,
    customer_name: o.customer_name ?? "",
    plate: o.plate ?? "",
    make: o.make ?? "",
    make_logo: o.make_logo ?? "",
    model: o.model ?? "",
    vehicle_version: o.vehicle_version ?? "",
    year: o.year ?? undefined,
    color: o.color ?? "",
    chassis: o.chassis ?? "",
    fuel_type: o.fuel_type ?? "",
    fipe_value: o.fipe_value ? parseFloat(o.fipe_value) : undefined,
    mileage_in: o.mileage_in ?? undefined,
    vehicle_location: o.vehicle_location ?? "workshop",
    entry_date: toLocalDatetime(o.entry_date),
    service_authorization_date: toLocalDatetime(o.service_authorization_date),
    scheduling_date: toLocalDatetime(o.scheduling_date),
    repair_days: o.repair_days ?? undefined,
    estimated_delivery_date: o.estimated_delivery_date ?? undefined,
    delivery_date: toLocalDatetime(o.delivery_date),
    final_survey_date: toLocalDatetime(o.final_survey_date),
    client_delivery_date: toLocalDatetime(o.client_delivery_date),
  }
}
