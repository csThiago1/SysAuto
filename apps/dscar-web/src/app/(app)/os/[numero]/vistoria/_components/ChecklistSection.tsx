"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, fetchList } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  mergeChecklist,
  type ChecklistStatus,
  type ServerChecklistItem,
} from "../_lib/checklist-catalog";

const API = "/api/proxy";

const STATUS_OPTIONS: Array<{ value: ChecklistStatus; label: string; cls: string }> = [
  { value: "ok", label: "OK", cls: "bg-success-400/15 text-success-400" },
  { value: "attention", label: "Atenção", cls: "bg-warning-500/15 text-warning-400" },
  { value: "critical", label: "Crítico", cls: "bg-error-500/15 text-error-400" },
];

interface ChecklistSectionProps {
  osId: string;
  checklistType: "entrada" | "saida";
}

export function ChecklistSection({
  osId,
  checklistType,
}: ChecklistSectionProps): React.ReactElement {
  const qc = useQueryClient();
  const queryKey = ["os-checklist", osId, checklistType];

  const { data: serverItems, isLoading } = useQuery<ServerChecklistItem[]>({
    queryKey,
    queryFn: () =>
      fetchList<ServerChecklistItem>(
        `${API}/service-orders/${osId}/checklist-items/?checklist_type=${checklistType}`
      ),
  });

  const upsert = useMutation({
    mutationFn: (item: { category: string; itemKey: string; status: ChecklistStatus }) =>
      apiFetch(`${API}/service-orders/${osId}/checklist-items/bulk/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              checklist_type: checklistType,
              category: item.category,
              item_key: item.itemKey,
              status: item.status,
            },
          ],
        }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
    onError: () => toast.error("Erro ao salvar item. Tente novamente."),
  });

  const items = useMemo(
    () => mergeChecklist(serverItems ?? [], checklistType),
    [serverItems, checklistType]
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando checklist…</p>;
  }

  let lastCategory = "";
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => {
        const showHeader = item.category !== lastCategory;
        lastCategory = item.category;
        return (
          <li key={`${item.category}:${item.itemKey}`}>
            {showHeader && (
              <p className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[item.category] ?? item.category}
              </p>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[11px] bg-card px-3 py-2">
              <span className="min-w-0 truncate text-sm">{item.label}</span>
              <span className="flex gap-1">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={item.status === opt.value}
                    disabled={upsert.isPending}
                    onClick={() =>
                      upsert.mutate({
                        category: item.category,
                        itemKey: item.itemKey,
                        status: opt.value,
                      })
                    }
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      item.status === opt.value
                        ? opt.cls
                        : "bg-muted text-muted-foreground/60"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
