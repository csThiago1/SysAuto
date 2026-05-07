"use client"

import Link from "next/link"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Skeleton,
  StatusBadge,
} from "@/components/ui"
import { useVehicleHistory } from "../../_hooks/useVehicleHistory"
import { formatCurrency, formatDate, formatOSNumber } from "@paddock/utils"
import type { ServiceOrderStatus } from "@paddock/types"

interface VehicleHistorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plate: string
  make?: string
  model?: string
  year?: number
  makeLogo?: string
  excludeId?: string
}

export function VehicleHistorySheet({
  open,
  onOpenChange,
  plate,
  make,
  model,
  year,
  makeLogo,
  excludeId,
}: VehicleHistorySheetProps) {
  const { data, isLoading } = useVehicleHistory(plate, excludeId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            {makeLogo ? (
              <img
                src={makeLogo}
                alt={make ?? ""}
                className="h-10 w-10 rounded-lg border border-border bg-muted/30 object-contain p-1"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
                <span className="text-lg">🚗</span>
              </div>
            )}
            <div>
              <SheetTitle className="text-lg font-bold font-mono tracking-wider">
                {plate}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {[make, model, year].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : data ? (
          <div className="space-y-6 mt-6">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard label="OS" value={String(data.summary.os_count)} />
              <SummaryCard
                label="Total Gasto"
                value={formatCurrency(Number(data.summary.total_spent))}
              />
              <SummaryCard
                label="Primeira Visita"
                value={data.summary.first_visit ? formatDate(data.summary.first_visit) : "—"}
              />
            </div>

            {/* OS list */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Ordens de Serviço
              </h3>
              {data.results.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma OS anterior para este veículo.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.results.map((os) => (
                    <Link
                      key={os.id}
                      href={`/os/${os.number}`}
                      target="_blank"
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-foreground">
                          OS #{formatOSNumber(os.number)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {os.entry_date ? formatDate(os.entry_date) : "—"}
                          {os.delivered_at ? ` → ${formatDate(os.delivered_at)}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-foreground">
                          {formatCurrency(os.total)}
                        </span>
                        <StatusBadge status={os.status as ServiceOrderStatus} size="sm" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  )
}
