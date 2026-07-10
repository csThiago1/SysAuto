"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { drainQueue } from "@/lib/offline/queue";
import { useOnline } from "./useOnline";

interface OfflineSyncState {
  pendingCount: number;
  conflictCount: number;
  failedCount: number;
  isOnline: boolean;
}

/** Contadores reativos da fila offline + drain automático ao reconectar. */
export function useOfflineSync(): OfflineSyncState {
  const isOnline = useOnline();

  const counts = useLiveQuery(
    async () => {
      const drafts = await db.drafts.toArray();
      return {
        pendingCount: drafts.filter((d) => d.status === "pending" || d.status === "syncing")
          .length,
        conflictCount: drafts.filter((d) => d.status === "conflict").length,
        failedCount: drafts.filter((d) => d.status === "failed").length,
      };
    },
    [],
    { pendingCount: 0, conflictCount: 0, failedCount: 0 },
  );

  useEffect(() => {
    if (isOnline) void drainQueue();
  }, [isOnline]);

  return { ...counts, isOnline };
}
