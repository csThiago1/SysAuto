import { synchronize } from '@nozbe/watermelondb/sync';

import { database } from './index';
import { API_BASE_URL } from '@/lib/constants';
import { useAuthStore } from '@/stores/auth.store';
import { useSyncStore } from '@/stores/sync.store';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncTableChanges {
  created: Record<string, unknown>[];
  updated: Record<string, unknown>[];
  deleted: string[];
}

interface SyncPullResponse {
  changes: {
    service_orders: SyncTableChanges;
  };
  timestamp: number;
}

// ─── Internal fetch helper ────────────────────────────────────────────────────
// Bypasses api.ts normalizer so the trailing slash stays before `?since=`.
// URL format: /api/v1/service-orders/sync/?since=<ISO>
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSyncPull(lastPulledAt: number | undefined): Promise<SyncPullResponse> {
  const { token, activeCompany } = useAuthStore.getState();

  // Base path always ends with `/` (Django APPEND_SLASH).
  // Query string is appended after the slash — no risk of double-slash.
  let url = `${API_BASE_URL}/api/v1/service-orders/sync/`;

  if (lastPulledAt !== undefined) {
    const since = new Date(lastPulledAt).toISOString();
    url += `?since=${encodeURIComponent(since)}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Domain': `${activeCompany}.localhost`,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Sync pull failed: HTTP ${response.status}`);
  }

  return response.json() as Promise<SyncPullResponse>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function syncServiceOrders(): Promise<void> {
  const { setIsSyncing, setLastSync } = useSyncStore.getState();

  setIsSyncing(true);

  try {
    await synchronize({
      database,

      pullChanges: async ({ lastPulledAt }) => {
        const data = await fetchSyncPull(lastPulledAt ?? undefined);

        return {
          changes: data.changes,
          timestamp: data.timestamp,
        };
      },

      // Push implementado no Sprint M5 (abertura de OS offline)
      pushChanges: async () => {
        // no-op for now
      },
    });

    setLastSync(Date.now());
  } finally {
    setIsSyncing(false);
  }
}
