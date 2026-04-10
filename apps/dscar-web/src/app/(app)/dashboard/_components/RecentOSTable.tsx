"use client";

/**
 * RecentOSTable — Tabela de OS recentes no Dashboard
 *
 * ANTES: inline em dashboard/page.tsx com formatDate local e statusConfig inline.
 * AGORA: componente isolado usando @paddock/utils formatDate, StatusBadge de @/components/ui.
 */

import React from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import type { ServiceOrder, CustomerType } from "@paddock/types";
import { formatDate, SERVICE_ORDER_STATUS_CONFIG, formatOSNumber } from "@paddock/utils";
import { StatusBadge, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── Customer type pill ────────────────────────────────────────────────────────

function CustomerTypePill({ type }: { type: CustomerType | null }) {
  if (!type) return <span className="text-neutral-300">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        type === "insurer"
          ? "bg-info-100 text-info-700"
          : "bg-neutral-100 text-neutral-600"
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
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-100">
            {["Nº", "Placa", "Cliente", "Tipo", "Status", "Entrada", "Dias"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-50">
          {orders.map((order) => (
            <tr
              key={order.id}
              className="hover:bg-neutral-50 transition-colors cursor-pointer"
              onClick={() => router.push(`/service-orders/${order.id}` as `/service-orders/${string}`)}
            >
              <td className="px-4 py-3 font-plate font-semibold text-neutral-800">
                #{formatOSNumber(order.number)}
              </td>
              <td className="px-4 py-3">
                <span className="font-plate font-bold tracking-wider text-neutral-900">
                  {order.plate}
                </span>
              </td>
              <td className="px-4 py-3 text-neutral-700 max-w-[160px] truncate">
                {order.customer_name}
              </td>
              <td className="px-4 py-3">
                <CustomerTypePill type={order.customer_type} />
              </td>
              <td className="px-4 py-3">
                {/* Uses global StatusBadge from @/components/ui */}
                <StatusBadge status={order.status} size="sm" />
              </td>
              <td className="px-4 py-3 text-neutral-500">
                {formatDate(order.entry_date)}
              </td>
              <td className="px-4 py-3 text-neutral-500">
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
    </div>
  );
}
