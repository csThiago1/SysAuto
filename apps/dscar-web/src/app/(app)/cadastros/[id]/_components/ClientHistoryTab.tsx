"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Car, DollarSign, FileText, Calendar } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
  Skeleton,
} from "@/components/ui"
import { formatCurrency, formatDate, formatOSNumber } from "@paddock/utils"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"

interface ClientHistoryTabProps {
  personId: string
  orders: ServiceOrder[]
  ordersLoading: boolean
  ordersCount: number
}

export function ClientHistoryTab({
  personId,
  orders,
  ordersLoading,
  ordersCount,
}: ClientHistoryTabProps) {
  const [plateFilter, setPlateFilter] = useState<string>("")

  const summary = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered")
    const totalSpent = delivered.reduce(
      (acc, o) =>
        acc +
        (Number(o.parts_total ?? 0) +
          Number(o.services_total ?? 0) -
          Number(o.discount_total ?? 0)),
      0
    )
    const firstDate = orders.length > 0
      ? orders.reduce((min, o) => {
          const d = o.entry_date ?? o.created_at
          return d && d < min ? d : min
        }, orders[0]?.entry_date ?? orders[0]?.created_at ?? "")
      : null

    return {
      totalSpent,
      osCount: ordersCount,
      avgTicket: delivered.length > 0 ? totalSpent / delivered.length : 0,
      firstDate,
    }
  }, [orders, ordersCount])

  const vehicles = useMemo(() => {
    const map = new Map<
      string,
      {
        plate: string
        make: string
        model: string
        year: number | null
        makeLogo: string | null
        osCount: number
        totalSpent: number
      }
    >()

    for (const os of orders) {
      if (!os.plate) continue
      const existing = map.get(os.plate)
      const osTotal =
        Number(os.parts_total ?? 0) +
        Number(os.services_total ?? 0) -
        Number(os.discount_total ?? 0)

      if (existing) {
        existing.osCount += 1
        if (os.status === "delivered") existing.totalSpent += osTotal
      } else {
        map.set(os.plate, {
          plate: os.plate,
          make: os.make ?? "",
          model: os.model ?? "",
          year: os.year ?? null,
          makeLogo: os.make_logo ?? null,
          osCount: 1,
          totalSpent: os.status === "delivered" ? osTotal : 0,
        })
      }
    }

    return Array.from(map.values())
  }, [orders])

  const filteredOrders = useMemo(() => {
    if (!plateFilter) return orders
    return orders.filter((o) => o.plate === plateFilter)
  }, [orders, plateFilter])

  if (ordersLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Total Gasto"
          value={formatCurrency(summary.totalSpent)}
        />
        <MetricCard
          icon={<FileText className="h-4 w-4" />}
          label="Ordens de Serviço"
          value={String(summary.osCount)}
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Ticket Médio"
          value={formatCurrency(summary.avgTicket)}
        />
        <MetricCard
          icon={<Calendar className="h-4 w-4" />}
          label="Cliente Desde"
          value={summary.firstDate ? formatDate(summary.firstDate) : "—"}
        />
      </div>

      {/* Vehicles section */}
      {vehicles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              Veículos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {vehicles.map((v) => (
                <button
                  key={v.plate}
                  type="button"
                  onClick={() =>
                    setPlateFilter(plateFilter === v.plate ? "" : v.plate)
                  }
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                    plateFilter === v.plate
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  {v.makeLogo ? (
                    <img
                      src={v.makeLogo}
                      alt={v.make}
                      className="h-8 w-8 shrink-0 rounded object-contain"
                    />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded bg-muted/50 flex items-center justify-center text-sm">
                      🚗
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold font-mono tracking-wider">
                      {v.plate}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {[v.make, v.model, v.year].filter(Boolean).join(" · ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {v.osCount} OS · {formatCurrency(v.totalSpent)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Ordens de Serviço
            </CardTitle>
            {plateFilter && (
              <button
                type="button"
                onClick={() => setPlateFilter("")}
                className="text-xs text-primary hover:underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma OS encontrada.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((os) => (
                <Link
                  key={os.id}
                  href={`/os/${os.number}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-foreground">
                      OS #{formatOSNumber(os.number)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {os.plate} · {os.make} {os.model}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {os.entry_date ? formatDate(os.entry_date) : "—"}
                      {os.delivered_at ? ` → ${formatDate(os.delivered_at)}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-foreground">
                      {formatCurrency(os.total ?? 0)}
                    </span>
                    <StatusBadge
                      status={os.status as ServiceOrderStatus}
                      size="sm"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
