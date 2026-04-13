import { synchronize } from '@nozbe/watermelondb/sync';
import { Q } from '@nozbe/watermelondb';

import { database } from './index';
import { ServiceOrder } from './models/ServiceOrder';
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

      // We ignore the WatermelonDB `changes` parameter and instead query for
      // push_status='pending' records directly. This is intentional:
      // - Our push_status field tracks push state idempotently
      // - After a successful push, push_status is set to 'synced'
      // - Subsequent syncs will not re-push the same record
      // - This approach is more reliable than relying on WatermelonDB's
      //   internal change tracking for outbound records
      pushChanges: async (_changes) => {
        // Query for pending records directly (more reliable than changes object)
        const collection = database.get<ServiceOrder>('service_orders');
        const pending = await collection.query(Q.where('push_status', 'pending')).fetch();

        const token = useAuthStore.getState().token;
        const company = useAuthStore.getState().activeCompany;

        for (const record of pending) {
          try {
            const res = await fetch(`${API_BASE_URL}/api/v1/service-orders/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token ?? ''}`,
                'X-Tenant-Domain': `${company ?? 'dscar'}.localhost`,
              },
              body: JSON.stringify({
                customer_name: record.customerName,
                plate: record.vehiclePlate,
                make: record.vehicleBrand,
                model: record.vehicleModel,
                year: record.vehicleYear ?? null,
                color: record.vehicleColor ?? null,
                customer_type: record.customerType,
                os_type: record.osType,
                status: 'reception',
                insurer: record.insurerId ?? null,
                insured_type: record.insuredType ?? null,
              }),
            });
            if (res.ok) {
              const data = (await res.json()) as { id: string; number: number };
              await database.write(async () => {
                await record.update((r) => {
                  r.remoteId = data.id;
                  r.number = data.number;
                  r.pushStatus = 'synced';
                });
              });
            } else {
              await database.write(async () => {
                await record.update((r) => { r.pushStatus = 'error'; });
              });
              console.warn('Push OS failed:', res.status);
            }
          } catch (err) {
            console.warn('Push OS error:', err);
            await database.write(async () => {
              await record.update((r) => { r.pushStatus = 'error'; });
            });
          }
        }
      },
    });

    setLastSync(Date.now());
  } finally {
    setIsSyncing(false);
  }
}
