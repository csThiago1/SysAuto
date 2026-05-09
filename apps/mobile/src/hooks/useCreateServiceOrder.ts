import { useState } from 'react';
import { database } from '@/db/index';
import { ServiceOrder } from '@/db/models/ServiceOrder';
import { api } from '@/lib/api';

export interface CreateOSPayload {
  customerName: string; customerId?: string; vehiclePlate: string;
  vehicleBrand: string; vehicleModel: string; vehicleYear?: number;
  vehicleColor?: string; customerType: 'insurer' | 'private';
  osType: 'bodywork' | 'warranty' | 'rework' | 'mechanical' | 'aesthetic';
  insurerId?: string; insuredType?: 'insured' | 'third';
  casualtyNumber?: string; deductibleAmount?: number;
}
export interface CreateOSResult { localId: string; remoteId: string; number: number; isOffline: boolean; }
interface ServiceOrderApiResponse { id: string; number: number; status: string; }

function generateTempId(): string { return Date.now().toString(36) + Math.random().toString(36).substring(2, 11); }

export function useCreateServiceOrder(): { create: (payload: CreateOSPayload) => Promise<CreateOSResult | null>; isCreating: boolean; error: string | null; } {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (payload: CreateOSPayload): Promise<CreateOSResult | null> => {
    setIsCreating(true); setError(null);
    try {
      try {
        const data = await api.post<ServiceOrderApiResponse>('/service-orders/', {
          customer_name: payload.customerName, customer: payload.customerId ?? null,
          plate: payload.vehiclePlate, make: payload.vehicleBrand, model: payload.vehicleModel,
          year: payload.vehicleYear ?? null, color: payload.vehicleColor ?? '',
          customer_type: payload.customerType, os_type: payload.osType,
          insurer: payload.insurerId ?? null, insured_type: payload.insuredType ?? null,
          casualty_number: payload.casualtyNumber ?? '', deductible_amount: payload.deductibleAmount ?? null,
        });
        const record = await database.write(async () => {
          return database.get<ServiceOrder>('service_orders').create((r) => {
            r._raw.id = data.id; r.remoteId = data.id; r.number = data.number; r.status = data.status;
            r.customerName = payload.customerName; r.vehiclePlate = payload.vehiclePlate;
            r.vehicleBrand = payload.vehicleBrand; r.vehicleModel = payload.vehicleModel;
            r.vehicleYear = payload.vehicleYear ?? null; r.vehicleColor = payload.vehicleColor ?? null;
            r.customerType = payload.customerType; r.osType = payload.osType;
            r.consultantName = null; r.totalParts = 0; r.totalServices = 0;
            r.createdAtRemote = Date.now(); r.updatedAtRemote = Date.now();
            r.syncedAt = Date.now(); r.pushStatus = 'synced';
            r.insurerId = payload.insurerId ?? null; r.insuredType = payload.insuredType ?? null;
          });
        });
        return { localId: record.id, remoteId: data.id, number: data.number, isOffline: false };
      } catch { /* API failed — offline fallback */ }

      const tempId = generateTempId();
      const offlineRecord = await database.write(async () => {
        return database.get<ServiceOrder>('service_orders').create((r) => {
          r.remoteId = tempId; r.number = 0; r.status = 'reception';
          r.customerName = payload.customerName; r.vehiclePlate = payload.vehiclePlate;
          r.vehicleBrand = payload.vehicleBrand; r.vehicleModel = payload.vehicleModel;
          r.vehicleYear = payload.vehicleYear ?? null; r.vehicleColor = payload.vehicleColor ?? null;
          r.customerType = payload.customerType; r.osType = payload.osType;
          r.consultantName = null; r.totalParts = 0; r.totalServices = 0;
          r.createdAtRemote = Date.now(); r.updatedAtRemote = Date.now();
          r.syncedAt = 0; r.pushStatus = 'pending';
          r.insurerId = payload.insurerId ?? null; r.insuredType = payload.insuredType ?? null;
        });
      });
      return { localId: offlineRecord.id, remoteId: tempId, number: 0, isOffline: true };
    } catch { setError('Erro ao criar OS. Tente novamente.'); return null; }
    finally { setIsCreating(false); }
  };

  return { create, isCreating, error };
}
