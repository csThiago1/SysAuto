import { Vehicle, VehicleBrand, VehicleModel, VehicleVersion, PlateLookupResult } from '../types';
import { apiRequest } from './client';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function lookupPlate(plate: string): Promise<PlateLookupResult | null> {
  try {
    return await apiRequest<PlateLookupResult>(`/vehicles/lookup/?plate=${encodeURIComponent(plate)}`);
  } catch (err: any) {
    if (err.message?.includes('404')) return null;
    throw err;
  }
}

export async function listBrands(vehicleType = 'car'): Promise<VehicleBrand[]> {
  const data = await apiRequest<PaginatedResponse<VehicleBrand>>(`/vehicles/brands/?vehicle_type=${vehicleType}&page_size=500`);
  return data.results;
}

export async function listModels(brandId: number): Promise<VehicleModel[]> {
  const data = await apiRequest<VehicleModel[]>(`/vehicles/brands/${brandId}/models/`);
  return data;
}

export async function listVersions(modelId: number): Promise<VehicleVersion[]> {
  const data = await apiRequest<VehicleVersion[]>(`/vehicles/catalog-models/${modelId}/versions/`);
  return data;
}

export async function listVehicles(plate?: string): Promise<Vehicle[]> {
  const query = plate ? `?plate=${encodeURIComponent(plate)}` : '';
  const data = await apiRequest<PaginatedResponse<Vehicle>>(`/vehicles/${query}`);
  return data.results;
}
