"use client";

import React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import type { ServiceOrder } from "@paddock/types";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(isoDate + "T00:00:00"));
}

function BadgeCount({ count }: { count: number }): React.ReactElement | null {
  if (count === 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold leading-none text-white">
      {label}
    </span>
  );
}

function OrderRow({ os }: { os: ServiceOrder }): React.ReactElement {
  const isOverdue = new Date(os.estimated_delivery! + "T00:00:00") < startOfToday();
  return (
    <Link
      href={`/os/${os.id}`}
      className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-b-0"
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-mono text-xs font-semibold text-neutral-900 uppercase tracking-wide">
          {os.plate}
        </span>
        <span className="text-xs text-neutral-500">OS #{os.number}</span>
      </div>
      <span
        className={cn(
          "text-xs font-medium shrink-0",
          isOverdue ? "text-red-600" : "text-yellow-600"
        )}
      >
        {formatDate(os.estimated_delivery!)}
      </span>
    </Link>
  );
}

export function NotificationBell(): React.ReactElement {
  const { data, isLoading } = useOverdueOrders();
  const orders = data?.results ?? [];
  const count = orders.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
          aria-label={`Notificações${count > 0 ? ` — ${count} OS com prazo` : ""}`}
        >
          <Bell className="h-5 w-5" />
          <BadgeCount count={count} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="px-4 py-3 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-900">
            {count > 0 ? `${count} OS com prazo` : "Prazos"}
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 px-4 py-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : count === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-400 text-center">
            Nenhuma OS com prazo hoje ou vencida.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {orders.map((os) => (
              <OrderRow key={os.id} os={os} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
