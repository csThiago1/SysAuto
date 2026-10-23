/**
 * @paddock/types — Vehicle Catalog
 */

// ─── Vehicle History (Consulta por Placa) ────────────────────────────────────

export interface VehicleHistory {
  found: boolean;
  plate?: string;
  make?: string;
  model?: string;
  year?: number | null;
  vehicle_version?: string;
  color?: string;
  fuel_type?: string;
  fipe_value?: string | null;
  last_customer_name?: string;
  last_customer_uuid?: string | null;
  visits?: number;
  last_visit?: string | null;
}
