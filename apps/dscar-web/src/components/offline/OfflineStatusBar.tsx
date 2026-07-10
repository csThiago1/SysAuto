"use client";

import { useState } from "react";
import { AlertTriangle, CloudOff, RefreshCw } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { ConflictDialog } from "./ConflictDialog";

export function OfflineStatusBar(): React.ReactElement | null {
  const { isOnline, pendingCount, conflictCount, failedCount } = useOfflineSync();
  const [dialogOpen, setDialogOpen] = useState(false);
  const problemCount = conflictCount + failedCount;

  if (isOnline && pendingCount === 0 && problemCount === 0) return null;

  const label = !isOnline
    ? `Offline${pendingCount > 0 ? ` · ${pendingCount} pendente(s)` : ""}`
    : problemCount > 0
      ? `${problemCount} conflito(s) de sync`
      : `Sincronizando ${pendingCount}…`;

  const tone =
    problemCount > 0
      ? "border-error-500/40 bg-error-500/10 text-error-600 dark:text-error-400"
      : "border-warning-500/40 bg-warning-500/10 text-warning-700 dark:text-warning-400";

  return (
    <>
      <button
        type="button"
        onClick={() => problemCount > 0 && setDialogOpen(true)}
        aria-label={label}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone} ${
          problemCount > 0 ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {!isOnline ? (
          <CloudOff className="h-3.5 w-3.5" aria-hidden />
        ) : problemCount > 0 ? (
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
        )}
        <span>{label}</span>
      </button>
      <ConflictDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
