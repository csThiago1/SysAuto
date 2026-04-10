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
