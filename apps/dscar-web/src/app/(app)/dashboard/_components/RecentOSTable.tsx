"use client";

/**
 * RecentOSTable — Tabela de OS recentes no Dashboard
 *
 * ANTES: inline em dashboard/page.tsx com formatDate local e statusConfig inline.
 * AGORA: componente isolado usando @paddock/utils formatDate, StatusBadge de @/components/ui.
 */

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import type { ServiceOrder, CustomerType } from "@paddock/types";
import { formatDate, SERVICE_ORDER_STATUS_CONFIG, formatOSNumber } from "@paddock/utils";
import { StatusBadge, EmptyState } from "@/components/ui";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { cn } from "@/lib/utils";

// ─── Customer type pill ────────────────────────────────────────────────────────

function CustomerTypePill({ type }: { type: CustomerType | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        type === "insurer"
          ? "bg-info-500/10 text-info-400"
          : "bg-muted/50 text-foreground/60"
      )}
    >
      {type === "insurer" ? "Seguradora" : "Particular"}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RecentOSTableProps {
  orders: ServiceOrder[];
}

export function RecentOSTable({ orders }: RecentOSTableProps): React.ReactElement {
  const router = useRouter();

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Nenhuma ordem de serviço encontrada."
        className="py-12"
      />
    );
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden space-y-2">
        {orders.map((order) => {
          const statusCfg = SERVICE_ORDER_STATUS_CONFIG[order.status];
          return (
            <div
              key={order.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/os/${order.number}`)}
              onKeyDown={(e) => { if (e.key === "Enter") router.push(`/os/${order.number}`); }}
              className="relative rounded-[11px] bg-card px-3 py-2.5 cursor-pointer hover:bg-primary/5 transition-colors"
            >
              <span aria-hidden className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px]", statusCfg.dot)} />
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[13px] font-semibold text-primary truncate">
                  #{formatOSNumber(order.number)}
                  {order.plate && <span className="font-normal text-muted-foreground"> · {order.plate}</span>}
                </span>
                <span className={cn("text-[11px] font-semibold shrink-0", statusCfg.text)}>{statusCfg.label}</span>
              </div>
              <p className="text-[13.5px] font-medium text-foreground truncate mt-0.5">
                {order.customer_name || "Sem nome"}
              </p>
              <div className="grid grid-cols-[minmax(0,1fr)_88px_60px] gap-2.5 items-baseline mt-[5px] font-mono text-[11.5px] tabular-nums text-muted-foreground">
                <span className="truncate">
                  {order.customer_type === "insurer" ? "Seguradora" : "Particular"}
                </span>
                <span className="text-right">{formatDate(order.entry_date)}</span>
                <span className="text-right">
                  {order.days_in_shop != null ? `${order.days_in_shop}d` : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-card">
        <ScrollFade>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                {["Nº", "Placa", "Cliente", "Tipo", "Status", "Entrada", "Dias"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/os/${order.number}`)}
                >
                  <td className="px-4 py-3 font-plate font-semibold text-foreground/90">
                    <Link
                      href={`/os/${order.number}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      #{formatOSNumber(order.number)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-plate font-bold tracking-wider text-foreground">
                      {order.plate}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/70 max-w-[160px] truncate">
                    {order.customer_name}
                  </td>
                  <td className="px-4 py-3">
                    <CustomerTypePill type={order.customer_type} />
                  </td>
                  <td className="px-4 py-3">
                    {/* Uses global StatusBadge from @/components/ui */}
                    <StatusBadge status={order.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(order.entry_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.days_in_shop != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {order.days_in_shop}d
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollFade>
      </div>
    </>
  );
}
