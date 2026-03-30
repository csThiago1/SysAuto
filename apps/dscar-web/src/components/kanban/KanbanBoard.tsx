"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types";
import {
  KANBAN_COLUMNS_ORDER,
  KANBAN_HIDDEN_BY_DEFAULT,
} from "@/lib/design-tokens";
import { KanbanColumn, KanbanColumnSkeleton } from "./KanbanColumn";
import { KanbanCardOverlay } from "./KanbanCard";

interface KanbanBoardProps {
  orders: ServiceOrder[];
  isLoading: boolean;
  showHidden?: boolean;
}

type OrdersMap = Record<ServiceOrderStatus, ServiceOrder[]>;

function groupByStatus(orders: ServiceOrder[]): OrdersMap {
  const map = {} as OrdersMap;
  for (const status of KANBAN_COLUMNS_ORDER) {
    map[status] = [];
  }
  for (const order of orders) {
    const key = order.status as ServiceOrderStatus;
    if (map[key]) {
      map[key].push(order);
    }
  }
  return map;
}

export function KanbanBoard({
  orders,
  isLoading,
  showHidden = false,
}: KanbanBoardProps): React.ReactElement {
  const qc = useQueryClient();
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null);
  // Optimistic override map: orderId → overridden status
  const [optimisticMoves, setOptimisticMoves] = useState<
    Record<string, ServiceOrderStatus>
  >({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const columns = useMemo(
    () =>
      showHidden
        ? KANBAN_COLUMNS_ORDER
        : KANBAN_COLUMNS_ORDER.filter(
            (s) => !KANBAN_HIDDEN_BY_DEFAULT.includes(s)
          ),
    [showHidden]
  );

  // Merge server data with optimistic overrides
  const groupedOrders = useMemo(() => {
    const patched = orders.map((o) => {
      const override = optimisticMoves[o.id];
      return override ? { ...o, status: override } : o;
    });
    return groupByStatus(patched);
  }, [orders, optimisticMoves]);

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      setActiveOrder(orders.find((o) => o.id === active.id) ?? null);
    },
    [orders]
  );

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveOrder(null);
      if (!over) return;

      const orderId = active.id as string;
      const newStatus = over.id as ServiceOrderStatus;
      const order = orders.find((o) => o.id === orderId);

      // No-op: same column or unknown target
      if (!order || order.status === newStatus) return;
      if (!KANBAN_COLUMNS_ORDER.includes(newStatus)) return;

      // Optimistic update — move card immediately
      setOptimisticMoves((prev) => ({ ...prev, [orderId]: newStatus }));

      try {
        const res = await fetch(
          `/api/proxy/service-orders/${orderId}/transition/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ new_status: newStatus }),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(
            (err as { detail?: string }).detail ?? `HTTP ${res.status}`
          );
        }

        // Sync server state after success
        void qc.invalidateQueries({ queryKey: ["service-orders"] });
      } catch (err) {
        // Rollback
        setOptimisticMoves((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
        toast.error(
          err instanceof Error ? err.message : "Erro ao mover OS"
        );
        return;
      }

      // Clear override after server sync is triggered
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    },
    [orders, qc]
  );

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((status) => (
          <KanbanColumnSkeleton key={status} />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-0 flex-1">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            orders={groupedOrders[status] ?? []}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOrder ? <KanbanCardOverlay order={activeOrder} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
