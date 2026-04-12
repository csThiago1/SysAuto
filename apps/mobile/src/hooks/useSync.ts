import { useEffect, useCallback } from 'react';

import { syncServiceOrders } from '@/db/sync';
import { useSyncStore } from '@/stores/sync.store';
import { useAuthStore } from '@/stores/auth.store';
import { useConnectivity } from './useConnectivity';

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

  const sync = useCallback(async (): Promise<void> => {
    if (!isOnline || isSyncing) return;
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
  }, [isOnline, isSyncing, logout]);

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
