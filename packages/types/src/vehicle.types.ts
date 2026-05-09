/**
 * @paddock/types — Vehicle Catalog
 */

export interface VehicleColor {
  id: number;
  name: string;
  hex_code: string;
}

export interface VehiclePlateLookup {
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  chassis: string;
  fuel_type: string;
  fipe_value?: string;
}

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

export interface PlateApiResult {
  plate: string;
  make: string;
  model: string;
  year: number | null;
  chassis: string;
  renavam: string;
  city: string;
}
