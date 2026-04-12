import { useState } from 'react';
import { database } from '@/db/index';
import { ServiceOrder } from '@/db/models/ServiceOrder';
import { api } from '@/lib/api';
import { useConnectivity } from '@/hooks/useConnectivity';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateOSPayload {
  customerName: string;
  customerId?: string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear?: number;
  vehicleColor?: string;
  customerType: 'insurer' | 'private';
  osType: 'bodywork' | 'warranty' | 'rework' | 'mechanical' | 'aesthetic';
  insurerName?: string;
  claimNumber?: string;
  deductible?: number;
}

export interface CreateOSResult {
  localId: string;
  remoteId: string;
  number: number;
  isOffline: boolean;
}

interface ServiceOrderApiResponse {
  id: string;
  number: number;
  status: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function generateTempId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCreateServiceOrder(): {
  create: (payload: CreateOSPayload) => Promise<CreateOSResult>;
  isCreating: boolean;
  error: string | null;
} {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useConnectivity();

  const create = async (payload: CreateOSPayload): Promise<CreateOSResult> => {
    setIsCreating(true);
    setError(null);

    try {
      // ── Online path ────────────────────────────────────────────────────────
      if (isOnline) {
        try {
          const data = await api.post<ServiceOrderApiResponse>('/service-orders/', {
            customer_name: payload.customerName,
            customer_id: payload.customerId ?? null,
            vehicle_plate: payload.vehiclePlate,
            vehicle_brand: payload.vehicleBrand,
            vehicle_model: payload.vehicleModel,
            vehicle_year: payload.vehicleYear ?? null,
            vehicle_color: payload.vehicleColor ?? null,
            customer_type: payload.customerType,
            os_type: payload.osType,
            insurer_name: payload.insurerName ?? null,
            claim_number: payload.claimNumber ?? null,
            deductible: payload.deductible ?? null,
          });

          // Persist to local DB as synced
          let localId = '';
          await database.write(async () => {
            const record = await database
              .get<ServiceOrder>('service_orders')
              .create((r) => {
                r.remoteId = data.id;
                r.number = data.number;
                r.status = data.status;
                r.customerName = payload.customerName;
                r.vehiclePlate = payload.vehiclePlate;
                r.vehicleBrand = payload.vehicleBrand;
                r.vehicleModel = payload.vehicleModel;
                r.vehicleYear = payload.vehicleYear ?? null;
                r.vehicleColor = payload.vehicleColor ?? null;
                r.customerType = payload.customerType;
                r.osType = payload.osType;
                r.consultantName = null;
                r.totalParts = 0;
                r.totalServices = 0;
                r.createdAtRemote = Date.now();
                r.updatedAtRemote = Date.now();
                r.syncedAt = Date.now();
                r.pushStatus = 'synced';
              });
            localId = record.id;
          });

          return { localId, remoteId: data.id, number: data.number, isOffline: false };
        } catch {
          // API failed — fall through to offline path
        }
      }

      // ── Offline path (or online POST failed) ──────────────────────────────
      const tempId = generateTempId();
      let localId = '';

      await database.write(async () => {
        const record = await database
          .get<ServiceOrder>('service_orders')
          .create((r) => {
            r.remoteId = tempId;
            r.number = 0;
            r.status = 'reception';
            r.customerName = payload.customerName;
            r.vehiclePlate = payload.vehiclePlate;
            r.vehicleBrand = payload.vehicleBrand;
            r.vehicleModel = payload.vehicleModel;
            r.vehicleYear = payload.vehicleYear ?? null;
            r.vehicleColor = payload.vehicleColor ?? null;
            r.customerType = payload.customerType;
            r.osType = payload.osType;
            r.consultantName = null;
            r.totalParts = 0;
            r.totalServices = 0;
            r.createdAtRemote = Date.now();
            r.updatedAtRemote = Date.now();
            r.syncedAt = 0;
            r.pushStatus = 'pending';
          });
        localId = record.id;
      });

      return { localId, remoteId: tempId, number: 0, isOffline: true };
    } catch {
      setError('Erro ao criar OS. Tente novamente.');
      throw new Error('Erro ao criar OS. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  };

  return { create, isCreating, error };
}
