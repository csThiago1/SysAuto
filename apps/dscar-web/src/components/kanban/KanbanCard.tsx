"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Clock } from "lucide-react";
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types";
import {
  SERVICE_ORDER_STATUS_CONFIG,
  getDaysInShopColor,
  getDaysInShopBorderColor,
} from "@paddock/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDaysOverdue(order: ServiceOrder): number | null {
  if (!order.estimated_delivery_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(order.estimated_delivery_date);
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

function DaysInShopBadge({ days }: { days: number | null }): React.ReactElement | null {
  if (days === null || days < 0) return null;
  const colorCls = getDaysInShopColor(days);
  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-medium", colorCls)}>
      <Clock className="h-3 w-3" />
      {days}d
    </span>
  );
}

function UrgencyIndicator({ order }: { order: ServiceOrder }): React.ReactElement | null {
  const daysOverdue = getDaysOverdue(order);
  if (daysOverdue === null || daysOverdue <= 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-error-400 bg-error-500/10 px-1.5 py-0.5 rounded-sm border border-error-500/30">
      <AlertTriangle className="h-3 w-3" />
      {daysOverdue}d atraso
    </span>
  );
}

// ── Shared card body ──────────────────────────────────────────────────────────

interface CardContentProps {
  order: ServiceOrder;
  className?: string;
}

const CardContent = React.memo(function CardContent({
  order,
  className,
}: CardContentProps): React.ReactElement {
  const statusCfg = SERVICE_ORDER_STATUS_CONFIG[order.status as ServiceOrderStatus];
  const daysOverdue = getDaysOverdue(order);
  const isOverdue = daysOverdue !== null && daysOverdue > 0;

  // Urgency overrides default border
  const borderCls = isOverdue
    ? "border-l-4 border-l-error-500"
    : (getDaysInShopBorderColor(order.days_in_shop) || statusCfg?.border || "");

  return (
    <div
      className={cn(
        "bg-muted/30 rounded-md border border-border backdrop-blur-sm",
        borderCls,
        className
      )}
    >
      <div className="p-2.5 space-y-1.5">
        {/* Row 1: OS number + status dot + days badge */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold text-foreground/80 leading-none font-mono">
            #{order.number}
          </span>
          <div className="flex items-center gap-1.5">
            <DaysInShopBadge days={order.days_in_shop} />
            <StatusBadge status={order.status as ServiceOrderStatus} variant="dot" />
          </div>
        </div>

        {/* Row 2: Plate */}
        <div className="text-sm font-mono font-semibold tracking-widest text-foreground/90 leading-none">
          {order.plate}
        </div>

        {/* Row 3: Vehicle */}
        <p className="text-xs text-muted-foreground leading-snug truncate">
          {[order.make, order.model, order.year ? String(order.year) : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {/* Row 4: Customer */}
        <p className="text-xs text-foreground/60 truncate font-medium">
          {order.customer_name}
        </p>

        {/* Row 5: Urgency / Insurer */}
        {(isOverdue || order.insurer_detail) && (
          <div className="flex items-center gap-1 flex-wrap pt-0.5">
            {isOverdue && <UrgencyIndicator order={order} />}
            {!isOverdue && order.insurer_detail && (
              <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-sm px-1 py-0.5 max-w-full">
                {order.insurer_detail.logo ? (
                  <img
                    src={order.insurer_detail.logo}
                    alt=""
                    className="h-3.5 w-3.5 object-contain shrink-0"
                  />
                ) : (
                  <span
                    className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-bold shrink-0"
                    style={{ backgroundColor: order.insurer_detail.brand_color ?? "#6366f1" }}
                  >
                    {order.insurer_detail.abbreviation?.charAt(0)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground font-medium truncate max-w-[90px]">
                  {order.insurer_detail.display_name ?? order.insurer_detail.name}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ── Draggable card ────────────────────────────────────────────────────────────

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

  const handleNavigate = () => {
    if (!isDragging) router.push(`/service-orders/${order.id}`);
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
      onClick={handleNavigate}
      onKeyDown={(e) => { if (e.key === "Enter") handleNavigate(); }}
    >
      <CardContent
        order={order}
        className={cn(
          isDragging
            ? "opacity-40 shadow-lg"
            : "shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150"
        )}
      />
    </div>
  );
});

// ── Overlay ───────────────────────────────────────────────────────────────────

export function KanbanCardOverlay({ order }: { order: ServiceOrder }): React.ReactElement {
  return (
    <CardContent
      order={order}
      className="rotate-1 shadow-xl cursor-grabbing"
    />
  );
}
