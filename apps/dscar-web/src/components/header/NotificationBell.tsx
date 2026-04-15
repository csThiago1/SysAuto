"use client";

import React from "react";
import Link from "next/link";
import { Bell, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import type { OverdueServiceOrder } from "@paddock/types";

function BadgeCount({ count }: { count: number }): React.ReactElement | null {
  if (count === 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center",
        "rounded-full bg-red-600 px-0.5 text-xs font-bold leading-none text-white",
        "animate-pulse"
      )}
    >
      {label}
    </span>
  );
}

function OrderItem({ item }: { item: OverdueServiceOrder }): React.ReactElement {
  const isOverdue = item.urgency === "overdue";
  const isDueToday = item.urgency === "due_today";

  return (
    <Link
      href={`/service-orders/${item.id}` as `/service-orders/${string}`}
      className={cn(
        "block px-3 py-2.5 border-l-4 mb-1 rounded-r hover:opacity-80 transition-opacity",
        isOverdue
          ? "bg-red-50 border-red-500"
          : isDueToday
          ? "bg-amber-50 border-amber-500"
          : "bg-neutral-50 border-neutral-300"
      )}
    >
      <p className="text-xs font-semibold text-neutral-900">
        OS #{item.number} · {item.plate} · {item.customer_name}
      </p>
      <p className="text-xs text-neutral-500 mt-0.5">
        {item.status_display} ·{" "}
        {isOverdue ? (
          <span className="font-bold text-red-600">
            Vencida há {item.days_overdue} dia{item.days_overdue !== 1 ? "s" : ""}
          </span>
        ) : isDueToday ? (
          <span className="text-amber-600 font-medium">Entrega hoje</span>
        ) : (
          <span className="text-neutral-400">Em {Math.abs(item.days_overdue)} dias</span>
        )}
      </p>
    </Link>
  );
}

export function NotificationBell(): React.ReactElement {
  const { data, isLoading, isError, refetch } = useOverdueOrders();
  const orders = data ?? [];
  const alertCount = orders.filter(
    (o) => o.urgency === "overdue" || o.urgency === "due_today"
  ).length;
  const overdue = orders.filter((o) => o.urgency === "overdue");
  const dueToday = orders.filter((o) => o.urgency === "due_today");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          aria-label="Notificações de OS"
          aria-haspopup="true"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          <BadgeCount count={alertCount} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-900">OS Vencidas / Hoje</p>
          {alertCount > 0 && (
            <span className="text-xs font-medium text-red-600">{alertCount}</span>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 px-4 py-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-red-600 mb-2">Erro ao carregar notificações.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-xs text-primary-600 hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="px-4 py-6 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="text-sm text-neutral-400">Nenhuma OS vencida ou com entrega hoje.</p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto px-3 py-2">
            {overdue.length > 0 && (
              <>
                <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1 px-1">
                  Atrasadas ({overdue.length})
                </p>
                {overdue.slice(0, 10).map((o) => (
                  <OrderItem key={o.id} item={o} />
                ))}
              </>
            )}
            {dueToday.length > 0 && (
              <>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mt-2 mb-1 px-1">
                  Entregam hoje ({dueToday.length})
                </p>
                {dueToday.slice(0, 10).map((o) => (
                  <OrderItem key={o.id} item={o} />
                ))}
              </>
            )}
          </div>
        )}

        {orders.length >= 10 && (
          <div className="border-t border-neutral-100 px-4 py-2.5">
            <Link
              href="/os?overdue=true"
              className="text-xs text-primary-600 hover:underline font-medium"
            >
              Ver todas as OS com prazo →
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
