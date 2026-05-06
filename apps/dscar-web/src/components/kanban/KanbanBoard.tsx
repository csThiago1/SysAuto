"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types";
import { VALID_TRANSITIONS } from "@paddock/types";
import {
  KANBAN_COLUMNS_ORDER,
  KANBAN_PHASE_GROUPS,
  SERVICE_ORDER_STATUS_CONFIG,
} from "@paddock/utils";
import { apiFetch } from "@/lib/api";
import { KanbanColumn, KanbanColumnSkeleton } from "./KanbanColumn";
import { KanbanCardOverlay } from "./KanbanCard";

interface KanbanBoardProps {
  orders: ServiceOrder[];
  isLoading: boolean;
  showDelivered?: boolean;
  showCancelled?: boolean;
}

type OrdersMap = Record<ServiceOrderStatus, ServiceOrder[]>;

function groupByStatus(orders: ServiceOrder[]): OrdersMap {
  const map = {} as OrdersMap;
  for (const status of KANBAN_COLUMNS_ORDER as ServiceOrderStatus[]) {
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
  showDelivered = false,
  showCancelled = false,
}: KanbanBoardProps): React.ReactElement {
  const qc = useQueryClient();
  const [activeOrder, setActiveOrder] = useState<ServiceOrder | null>(null);
  // Optimistic override map: orderId → overridden status
  const [optimisticMoves, setOptimisticMoves] = useState<
    Record<string, ServiceOrderStatus>
  >({});
  // Tracks in-flight POSTs — prevents double-submit if user drags before refetch
  const pendingIds = useRef(new Set<string>());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const columns = useMemo(
    () =>
      KANBAN_COLUMNS_ORDER.filter((s) => {
        if (s === "delivered") return showDelivered;
        if (s === "cancelled") return showCancelled;
        return true;
      }),
    [showDelivered, showCancelled]
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
      // Block while a transition for this card is already in flight
      if (pendingIds.current.has(orderId)) return;
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      // over.id pode ser o status da coluna (area vazia) ou o UUID de um card alvo.
      // Se for UUID de card, encontra em qual coluna ele está para derivar o status.
      const overId = over.id as string;
      let newStatus: ServiceOrderStatus;
      if (KANBAN_COLUMNS_ORDER.includes(overId as ServiceOrderStatus)) {
        newStatus = overId as ServiceOrderStatus;
      } else {
        // Resolve a coluna do card alvo
        const targetOrder = orders.find((o) => o.id === overId);
        if (!targetOrder) return;
        newStatus = (optimisticMoves[targetOrder.id] ?? targetOrder.status) as ServiceOrderStatus;
      }

      // Usa o status otimista (se existir) para evitar double-submit durante refetch
      const currentStatus = optimisticMoves[orderId] ?? order.status;
      if (currentStatus === newStatus) return;

      // Valida transição client-side antes de chamar o backend
      const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(newStatus)) {
        const targetLabel = SERVICE_ORDER_STATUS_CONFIG[newStatus]?.label ?? newStatus;
        const allowedLabels = allowed
          .map((s) => SERVICE_ORDER_STATUS_CONFIG[s as ServiceOrderStatus]?.label ?? s)
          .join(", ");
        toast.error(
          `Não é possível mover para "${targetLabel}". ` +
          (allowedLabels ? `Próximo(s) passo(s): ${allowedLabels}` : "Nenhuma transição disponível.")
        );
        return;
      }

      // Optimistic update — move card immediately
      setOptimisticMoves((prev) => ({ ...prev, [orderId]: newStatus }));
      pendingIds.current.add(orderId);

      try {
        await apiFetch(
          `/api/proxy/service-orders/${orderId}/transition/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ new_status: newStatus }),
          }
        );

        // Sync server state after success
        void qc.invalidateQueries({ queryKey: ["service-orders"] });
      } catch (err) {
        // Rollback optimistic move on any error
        setOptimisticMoves((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
        toast.error(
          err instanceof Error ? err.message : "Erro ao mover OS"
        );
        return;
      } finally {
        pendingIds.current.delete(orderId);
      }

      // Clear override after server sync is triggered
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    },
    [orders, qc, optimisticMoves]
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

  // Build phase groups filtered to only visible columns
  const visiblePhaseGroups = KANBAN_PHASE_GROUPS.map((group) => ({
    ...group,
    statuses: group.statuses.filter((s) =>
      columns.includes(s as ServiceOrderStatus)
    ) as ServiceOrderStatus[],
  })).filter((g) => g.statuses.length > 0);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-0 flex-1 items-start">
        {visiblePhaseGroups.map((group) => (
          <div key={group.id} className="flex flex-col shrink-0">
            {/* Phase group header */}
            <div
              className={`rounded-t-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${group.headerClass}`}
            >
              {group.label}
            </div>
            {/* Columns in this group */}
            <div className="flex gap-3">
              {group.statuses.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  orders={groupedOrders[status] ?? []}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOrder ? <KanbanCardOverlay order={activeOrder} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
