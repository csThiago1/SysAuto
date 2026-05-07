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
    expert_date: o.expert_date ?? undefined,
    survey_date: o.survey_date ?? undefined,
    authorization_date: o.authorization_date ?? undefined,
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
    entry_date: o.entry_date ?? undefined,
    service_authorization_date: o.service_authorization_date ?? undefined,
    scheduling_date: o.scheduling_date ?? undefined,
    repair_days: o.repair_days ?? undefined,
    estimated_delivery_date: o.estimated_delivery_date ?? undefined,
    delivery_date: o.delivery_date ?? undefined,
    final_survey_date: o.final_survey_date ?? undefined,
    client_delivery_date: o.client_delivery_date ?? undefined,
  }
}
