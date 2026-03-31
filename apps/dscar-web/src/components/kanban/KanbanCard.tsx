"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types";
import { SERVICE_ORDER_STATUS_CONFIG } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

// ── Shared card body ────────────────────────────────────────────────────────

interface CardContentProps {
  order: ServiceOrder;
  className?: string;
}

const CardContent = React.memo(function CardContent({
  order,
  className,
}: CardContentProps): React.ReactElement {
  const statusCfg = SERVICE_ORDER_STATUS_CONFIG[order.status as ServiceOrderStatus];

  return (
    <div
      className={cn(
        "bg-white rounded-md border border-neutral-200",
        statusCfg?.border,
        className
      )}
    >
      <div className="p-3 space-y-2">
        {/* OS number + status dot */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-os-number leading-none">#{order.number}</span>
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              statusCfg?.dot ?? "bg-neutral-400"
            )}
          />
        </div>

        {/* Plate — text-plate already provides font, weight, letter-spacing */}
        <div className="text-plate text-secondary-950">{order.plate}</div>

        {/* Vehicle */}
        <p className="text-xs text-neutral-600 leading-snug truncate">
          {order.make} {order.model}
          {order.year ? ` · ${order.year}` : ""}
        </p>

        {/* Customer */}
        {order.customer_id ? (
          <Link
            href={`/clientes/${order.customer_id}`}
            className="text-xs text-neutral-500 truncate hover:text-primary-600 hover:underline transition-colors block"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          >
            {order.customer_name}
          </Link>
        ) : (
          <p className="text-xs text-neutral-500 truncate">{order.customer_name}</p>
        )}
      </div>
    </div>
  );
});

// ── Draggable card (inside a column) ────────────────────────────────────────

interface KanbanCardProps {
  order: ServiceOrder;
}

export const KanbanCard = React.memo(function KanbanCard({
  order,
}: KanbanCardProps): React.ReactElement {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`OS #${order.number} — ${order.plate}`}
      className="cursor-grab active:cursor-grabbing select-none"
      onClick={() => { if (!isDragging) router.push(`/os/${order.id}`); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !isDragging) router.push(`/os/${order.id}`); }}
    >
      <CardContent
        order={order}
        className={cn(
          isDragging
            ? "opacity-40 shadow-kanban"
            : "shadow-kanban hover:shadow-kanban-drag transition-shadow duration-normal"
        )}
      />
    </div>
  );
});

// ── Overlay — pure presentational, no dnd hooks ──────────────────────────────

export function KanbanCardOverlay({ order }: { order: ServiceOrder }): React.ReactElement {
  return (
    <CardContent
      order={order}
      className="rotate-1 shadow-kanban-drag cursor-grabbing"
    />
  );
}
