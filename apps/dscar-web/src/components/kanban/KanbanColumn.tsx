"use client";

import React, { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types";
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  status: ServiceOrderStatus;
  orders: ServiceOrder[];
}

export const KanbanColumn = React.memo(function KanbanColumn({
  status,
  orders,
}: KanbanColumnProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg = SERVICE_ORDER_STATUS_CONFIG[status];

  // Stable array reference — SortableContext only re-processes when IDs actually change
  const ids = useMemo(() => orders.map((o) => o.id), [orders]);

  return (
    <div className="flex flex-col min-w-[220px] w-[220px]">
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-md bg-muted/30 border border-b-0 border-border"
      >
        <span className="label-mono text-foreground/70 truncate">
          {cfg.label}
        </span>
        <span className="ml-2 shrink-0 rounded-full bg-muted px-1.5 py-0.5 label-mono text-muted-foreground leading-none">
          {orders.length}
        </span>
      </div>

      {/* Drop zone — independent scroll per column */}
      <div
        ref={setNodeRef}
        className={cn(
          "overflow-y-auto rounded-b-md p-2 space-y-2 min-h-[100px] max-h-[calc(100vh-220px)]",
          "bg-muted/30 border border-t-0 border-border",
          "transition-colors",
          isOver && "bg-primary/5 border-primary/20"
        )}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {orders.map((order) => (
            <KanbanCard key={order.id} order={order} />
          ))}
        </SortableContext>

        {orders.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground select-none">
            Vazia
          </div>
        )}
      </div>
    </div>
  );
});

/** Skeleton shown while data is loading */
export function KanbanColumnSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col min-w-[280px] w-[280px]">
      <Skeleton className="h-10 rounded-b-none" />
      <div className="rounded-b-md border border-t-0 border-border bg-muted/30 p-2 space-y-2 min-h-[200px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}
