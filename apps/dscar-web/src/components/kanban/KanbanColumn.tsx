"use client";

import React, { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types";
import { SERVICE_ORDER_STATUS_CONFIG } from "@/lib/design-tokens";
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
    <div className="flex flex-col min-w-[280px] w-[280px] max-h-full">
      {/* Column header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2.5 rounded-t-md",
          cfg.column
        )}
      >
        <span className="text-sm font-semibold text-white truncate">
          {cfg.label}
        </span>
        <span className="ml-2 shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-white">
          {orders.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto rounded-b-md p-2 space-y-2 min-h-[120px]",
          "bg-neutral-100 border border-t-0 border-neutral-200",
          "transition-colors duration-fast",
          isOver && "bg-neutral-200 border-neutral-300"
        )}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {orders.map((order) => (
            <KanbanCard key={order.id} order={order} />
          ))}
        </SortableContext>

        {orders.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-neutral-400 italic">
            Nenhuma OS
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
      <div className="rounded-b-md border border-t-0 border-neutral-200 bg-neutral-100 p-2 space-y-2 min-h-[200px]">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}
