import { useEffect, useCallback, useRef } from 'react';

import { syncServiceOrders } from '@/db/sync';
import { resetLocalDatabase } from '@/db/index';
import { useSyncStore } from '@/stores/sync.store';
import { useAuthStore } from '@/stores/auth.store';
import { useConnectivity } from './useConnectivity';

// One-time DB reset flag — increment when schema adds fields to existing records
const DB_RESET_VERSION = 'db_reset_v5';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mmkv: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv');
  _mmkv = new MMKV({ id: 'sync-meta' });
} catch { /* Expo Go */ }

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseSyncResult {
  sync: () => Promise<void>;
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingUploads: number;
  isOnline: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSync(): UseSyncResult {
  const isOnline = useConnectivity();
  const { lastSyncAt, isSyncing, pendingUploads } = useSyncStore();
  const logout = useAuthStore((s) => s.logout);

  const didResetRef = useRef(false);

  const sync = useCallback(async (): Promise<void> => {
    if (isSyncing) return;

    // One-time DB reset: garante que campos novos (make_logo etc.) são populados
    if (!didResetRef.current && _mmkv) {
      didResetRef.current = true;
      const done = _mmkv.getBoolean(DB_RESET_VERSION);
      if (!done) {
        try {
          await resetLocalDatabase();
          _mmkv.set(DB_RESET_VERSION, true);
        } catch {
          // Se falhar, segue com o DB existente
        }
      }
    }

    try {
      await syncServiceOrders();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('401')) {
        // Token inválido ou expirado — forçar logout para que o usuário
        // autentique novamente e obtenha um token válido do backend.
        logout();
        return;
      }
      // Demais falhas são silenciosas — modo offline continuará funcionando.
      console.warn('Sync failed:', error);
    }
  }, [isSyncing, logout]);

  // Auto-sync quando o app vai para foreground ou quando fica online.
  useEffect(() => {
    if (isOnline) {
      void sync();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sync,
    isSyncing,
    lastSyncAt,
    pendingUploads,
    isOnline,
  };
}
