"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Car, DollarSign, CheckCircle } from "lucide-react"
import { formatDate } from "@paddock/utils"

import type { ServiceOrder } from "@paddock/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  StatusBadge
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { BillingModal } from "../[id]/_components/BillingModal"

interface ServiceOrderTableProps {
  orders: ServiceOrder[]
}

export function ServiceOrderTable({ orders }: ServiceOrderTableProps) {
  const router = useRouter()
  const [billingOrder, setBillingOrder] = useState<ServiceOrder | null>(null)

  const BILLABLE_STATUSES = new Set([
    "authorized", "repair", "mechanic", "bodywork", "painting",
    "assembly", "polishing", "washing", "final_survey", "ready",
  ])

  return (
    <>
    <div className="rounded-md border bg-muted/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border">
            <TableHead className="w-[80px] label-mono text-muted-foreground">OS</TableHead>
            <TableHead className="min-w-[160px] label-mono text-muted-foreground">CLIENTE</TableHead>
            <TableHead className="w-[140px] label-mono text-muted-foreground">SEGURADORA</TableHead>
            <TableHead className="w-[100px] label-mono text-muted-foreground">PLACA</TableHead>
            <TableHead className="min-w-[150px] label-mono text-muted-foreground">VEÍCULO</TableHead>
            <TableHead className="w-[130px] label-mono text-muted-foreground">DATAS</TableHead>
            <TableHead className="w-[150px] label-mono text-muted-foreground">STATUS</TableHead>
            <TableHead className="w-[50px] label-mono text-muted-foreground">$</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const isLate = order.estimated_delivery_date && new Date(order.estimated_delivery_date) < new Date() && order.status !== "delivered"

            return (
              <TableRow
                key={order.id}
                className="group hover:bg-primary-500/5 cursor-pointer transition-colors"
                onClick={() => router.push(`/service-orders/${order.id}`)}
              >
                {/* OS Number */}
                <TableCell className="font-medium text-foreground">
                  <span className="text-primary-600 font-bold">#{order.number}</span>
                </TableCell>

                {/* Cliente */}
                <TableCell>
                  <span className="text-sm font-medium text-foreground truncate block max-w-[200px]">
                    {order.customer_name || "Sem nome"}
                  </span>
                </TableCell>

                {/* Seguradora */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-muted/50 border border-border">
                      {order.customer_type === "insurer" && order.insurer_detail?.logo ? (
                        <img src={order.insurer_detail.logo} alt="" className="h-full w-full object-contain p-0.5" />
                      ) : order.customer_type === "insurer" && order.insurer_detail?.abbreviation ? (
                        <span
                          className="h-full w-full flex items-center justify-center text-foreground text-[9px] font-bold"
                          style={{ backgroundColor: order.insurer_detail?.brand_color ?? "#6366f1" }}
                        >
                          {order.insurer_detail.abbreviation.slice(0, 2)}
                        </span>
                      ) : (
                        <img src="/dscar-logo.png" alt="DS Car" className="h-4 w-4 object-contain" />
                      )}
                    </div>
                    <span className="text-xs text-foreground/60 truncate max-w-[100px]">
                      {order.customer_type === "insurer"
                        ? (order.insurer_detail?.display_name ?? "Seguradora")
                        : "Particular"}
                    </span>
                  </div>
                </TableCell>

                {/* Placa */}
                <TableCell>
                  <span className="text-xs font-mono text-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded border border-border uppercase">
                    {order.plate || "—"}
                  </span>
                </TableCell>

                {/* Veículo */}
                <TableCell>
                  <span className="text-sm text-foreground/80 flex items-center gap-1.5">
                    {order.make_logo ? (
                      <img src={order.make_logo} alt={order.make} className="h-4 w-4 object-contain shrink-0" />
                    ) : (
                      <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">
                      {order.make} {order.model} {order.year ? `(${order.year})` : ""}
                    </span>
                  </span>
                </TableCell>

                {/* Datas */}
                <TableCell>
                  <div className="flex flex-col gap-0.5 text-xs">
                    <div className="flex items-center justify-between gap-2 text-foreground/60">
                      <span className="text-muted-foreground">Entr:</span>
                      <span>{formatDate(order.entry_date)}</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-between gap-2 font-medium",
                      isLate ? "text-error-600" : "text-foreground/70"
                    )}>
                      <span className={cn(isLate ? "text-error-500" : "text-muted-foreground")}>Prev:</span>
                      <span>{formatDate(order.estimated_delivery_date)}</span>
                    </div>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>

                {/* Faturamento */}
                <TableCell>
                  {!order.invoice_issued && BILLABLE_STATUSES.has(order.status) ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setBillingOrder(order) }}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-success-400 hover:bg-success-500/10 transition-colors"
                      title="Faturar OS"
                    >
                      <DollarSign className="h-4 w-4" />
                    </button>
                  ) : order.invoice_issued ? (
                    <CheckCircle className="h-4 w-4 text-success-400 mx-auto" title="OS faturada" />
                  ) : null}
                </TableCell>

                {/* Ação */}
                <TableCell className="text-right">
                  <Link
                    href={`/service-orders/${order.id}`}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-primary-600 hover:bg-primary-500/5 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>

      {billingOrder && (
        <BillingModal
          open={!!billingOrder}
          onOpenChange={(open) => { if (!open) setBillingOrder(null) }}
          order={billingOrder}
        />
      )}
    </>
  )
}
