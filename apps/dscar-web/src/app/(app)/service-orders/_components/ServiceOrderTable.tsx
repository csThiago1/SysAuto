"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, CalendarClock, Car, User } from "lucide-react"
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

interface ServiceOrderTableProps {
  orders: ServiceOrder[]
}



export function ServiceOrderTable({ orders }: ServiceOrderTableProps) {
  const router = useRouter()
  return (
    <div className="rounded-md border bg-white/5 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-white/[0.03] hover:bg-white/[0.03] border-b border-white/10">
            <TableHead className="w-[100px] label-mono text-white/40">OS</TableHead>
            <TableHead className="min-w-[200px] label-mono text-white/40">CLIENTE / SEGURADORA</TableHead>
            <TableHead className="min-w-[180px] label-mono text-white/40">VEÍCULO</TableHead>
            <TableHead className="w-[140px] label-mono text-white/40">DATAS</TableHead>
            <TableHead className="w-[180px] label-mono text-white/40">STATUS</TableHead>
            <TableHead className="w-[60px] label-mono text-white/40"></TableHead>
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
                <TableCell className="font-medium text-white">
                  <div className="flex items-center gap-1.5">
                     <span className="text-primary-600 font-bold">#{order.number}</span>
                  </div>
                </TableCell>

                {/* Cliente / Seguradora */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    {/* Logo: seguradora ou DS Car */}
                    {order.customer_type === "insurer" ? (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-white/5 border border-white/10">
                        {order.insurer_detail?.logo ? (
                          <img src={order.insurer_detail.logo} alt={order.insurer_detail.display_name ?? ""} className="h-full w-full object-contain p-0.5" />
                        ) : (
                          <span
                            className="h-full w-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: order.insurer_detail?.brand_color ?? "#6366f1" }}
                          >
                            {order.insurer_detail?.abbreviation?.slice(0, 2) ?? "S"}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-black border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/dscar-logo.png" alt="DS Car" className="h-6 w-6 object-contain" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white truncate max-w-[200px]">
                        {order.customer_name || "Sem nome"}
                      </span>
                      <span className="text-xs text-white/50 font-medium flex items-center gap-1">
                        {order.customer_type === "insurer" ? (
                          order.insurer_detail?.display_name ?? "Seguradora"
                        ) : (
                          <><span className="w-1.5 h-1.5 rounded-full bg-success-500 mr-0.5"></span>Particular</>
                        )}
                      </span>
                    </div>
                  </div>
                </TableCell>

                {/* Veículo */}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5 text-white/40" />
                      {order.make} {order.model} {order.year ? `(${order.year})` : ""}
                    </span>
                    <span className="text-xs font-mono text-white/50 bg-white/5 px-1.5 py-0.5 rounded w-fit mt-0.5 border border-white/10 uppercase">
                      {order.plate || "SEM PLACA"}
                    </span>
                  </div>
                </TableCell>

                {/* Datas */}
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center justify-between gap-2 text-white/60">
                      <span className="text-xs text-white/40">Entr:</span>
                      <span>{formatDate(order.entry_date)}</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-between gap-2 font-medium",
                      isLate ? "text-error-600" : "text-white/70"
                    )}>
                      <span className={cn("text-xs", isLate ? "text-error-500" : "text-white/40")}>Prev:</span>
                      <span>{formatDate(order.estimated_delivery_date)}</span>
                    </div>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>

                {/* Ações */}
                <TableCell className="text-right">
                  <Link 
                    href={`/service-orders/${order.id}`}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-white/40 hover:text-primary-600 hover:bg-primary-500/5 transition-colors"
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
  )
}
