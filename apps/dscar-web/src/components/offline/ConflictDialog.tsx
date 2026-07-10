"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { describeDraft } from "@/lib/offline/describe";
import { discardDraft, keepMine } from "@/lib/offline/queue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Extrai o id da OS da URL do draft pra linkar "Ver OS". */
function osIdFromUrl(url: string): string | null {
  const m = url.match(/\/service-orders\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

export function ConflictDialog({ open, onOpenChange }: ConflictDialogProps): React.ReactElement {
  const drafts = useLiveQuery(
    () => db.drafts.where("status").anyOf("conflict", "failed").toArray(),
    [],
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conflitos de sincronização</DialogTitle>
          <DialogDescription>
            Estas alterações feitas offline não puderam ser aplicadas automaticamente.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {drafts.map((d) => {
            const osId = osIdFromUrl(d.url);
            return (
              <li key={d.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{describeDraft(d)}</p>
                {d.lastError && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{d.lastError}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {osId && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/os/${osId}`} onClick={() => onOpenChange(false)}>
                        Ver OS no servidor
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => void keepMine(d.id)}>
                    {d.status === "conflict" ? "Manter minhas alterações" : "Tentar novamente"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void discardDraft(d.id)}>
                    Descartar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
