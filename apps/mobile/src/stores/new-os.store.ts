import { create } from 'zustand';
import type { VehicleInfo } from '@/hooks/useVehicleByPlate';
import type { CustomerSearchResult } from '@/hooks/useCustomerSearch';

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomerType = 'insurer' | 'private';
type OSType = 'bodywork' | 'warranty' | 'rework' | 'mechanical' | 'aesthetic';

export type { CustomerType, OSType };

export interface NewOSState {
  // Step 1 — Vehicle
  vehiclePlate: string;
  vehicleInfo: VehicleInfo | null;
  vehicleManualBrand: string;
  vehicleManualModel: string;
  vehicleManualYear: string;
  vehicleManualColor: string;
  plateSource: 'api' | 'manual' | null;

  // Step 2 — Customer
  customer: CustomerSearchResult | null;
  customerManualName: string;
  customerSource: 'search' | 'manual' | null;

  // Step 3 — OS Type
  customerType: CustomerType;
  osType: OSType;
  insurerName: string;
  claimNumber: string;
  deductible: string;

  // Actions
  setVehiclePlate: (plate: string) => void;
  setVehicleInfo: (info: VehicleInfo | null, source: 'api' | 'manual') => void;
  setVehicleManualField: (field: 'brand' | 'model' | 'year' | 'color', value: string) => void;
  setCustomer: (customer: CustomerSearchResult | null, source: 'search' | 'manual') => void;
  setCustomerManualName: (name: string) => void;
  setCustomerType: (type: CustomerType) => void;
  setOSType: (type: OSType) => void;
  setInsurer: (name: string) => void;
  setClaimNumber: (n: string) => void;
  setDeductible: (d: string) => void;
  reset: () => void;
}

// ─── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  vehiclePlate: '',
  vehicleInfo: null,
  vehicleManualBrand: '',
  vehicleManualModel: '',
  vehicleManualYear: '',
  vehicleManualColor: '',
  plateSource: null,
  customer: null,
  customerManualName: '',
  customerSource: null,
  customerType: 'private' as CustomerType,
  osType: 'bodywork' as OSType,
  insurerName: '',
  claimNumber: '',
  deductible: '',
};

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useNewOSStore = create<NewOSState>()((set) => ({
  ...initialState,

  setVehiclePlate: (plate: string): void => set({ vehiclePlate: plate }),

  setVehicleInfo: (info: VehicleInfo | null, source: 'api' | 'manual'): void =>
    set({ vehicleInfo: info, plateSource: info !== null ? source : null }),

  setVehicleManualField: (field: 'brand' | 'model' | 'year' | 'color', value: string): void => {
    switch (field) {
      case 'brand':
        set({ vehicleManualBrand: value });
        break;
      case 'model':
        set({ vehicleManualModel: value });
        break;
      case 'year':
        set({ vehicleManualYear: value });
        break;
      case 'color':
        set({ vehicleManualColor: value });
        break;
    }
  },

  setCustomer: (customer: CustomerSearchResult | null, source: 'search' | 'manual'): void =>
    set({ customer, customerSource: source }),

  setCustomerManualName: (name: string): void => set({ customerManualName: name }),

  setCustomerType: (type: CustomerType): void => set({ customerType: type }),

  setOSType: (type: OSType): void => set({ osType: type }),

  setInsurer: (name: string): void => set({ insurerName: name }),

  setClaimNumber: (n: string): void => set({ claimNumber: n }),

  setDeductible: (d: string): void => set({ deductible: d }),

  reset: (): void => set({ ...initialState }),
}));
