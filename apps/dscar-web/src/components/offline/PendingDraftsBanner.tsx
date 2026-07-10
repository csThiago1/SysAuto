"use client";

import { CloudOff } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { describeDraft } from "@/lib/offline/describe";

/**
 * Banner acima da lista de OS com as alterações aguardando sync.
 * ponytail: banner em vez de mesclar drafts como linhas na tabela paginada —
 * mesclar exigiria acoplar a fila ao shape do DRF; promover se faltar na prática.
 */
export function PendingDraftsBanner(): React.ReactElement | null {
  const drafts = useLiveQuery(() => db.drafts.toArray(), [], []);
  if (drafts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-sm text-warning-700 dark:text-warning-400">
      <CloudOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        {drafts.length} alteraç{drafts.length === 1 ? "ão" : "ões"} aguardando sincronização:
      </span>
      {drafts.map((d) => (
        <span key={d.id} className="rounded-full border border-warning-500/30 px-2 py-0.5 text-xs">
          {describeDraft(d)}
          {d.status === "conflict" && " · conflito"}
          {d.status === "failed" && " · falhou"}
        </span>
      ))}
    </div>
  );
}
