import React from "react"
import Link from "next/link"
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
  Avatar,
  StatusBadge
} from "@/components/ui"
import { cn } from "@/lib/utils"

interface ServiceOrderTableProps {
  orders: ServiceOrder[]
}



export function ServiceOrderTable({ orders }: ServiceOrderTableProps) {
  return (
    <div className="rounded-md border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-neutral-50 hover:bg-neutral-50 border-b border-neutral-200">
            <TableHead className="w-[100px] font-semibold text-neutral-600">OS</TableHead>
            <TableHead className="min-w-[200px] font-semibold text-neutral-600">Cliente / Seguradora</TableHead>
            <TableHead className="min-w-[180px] font-semibold text-neutral-600">Veículo</TableHead>
            <TableHead className="w-[140px] font-semibold text-neutral-600">Datas</TableHead>
            <TableHead className="w-[180px] font-semibold text-neutral-600">Status</TableHead>
            <TableHead className="w-[60px] text-right font-semibold text-neutral-600"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const isLate = order.estimated_delivery_date && new Date(order.estimated_delivery_date) < new Date() && order.status !== "delivered"

            return (
              <TableRow key={order.id} className="group hover:bg-primary-50/30 cursor-pointer transition-colors">
                {/* OS Number */}
                <TableCell className="font-medium text-neutral-900">
                  <div className="flex items-center gap-1.5">
                     <span className="text-primary-600 font-bold">#{order.number}</span>
                  </div>
                </TableCell>

                {/* Cliente / Seguradora */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={order.customer_name || "Cliente"} className="h-8 w-8" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-neutral-900 truncate max-w-[200px]">
                        {order.customer_name || "Sem nome"}
                      </span>
                      <span className="text-xs text-neutral-500 font-medium flex items-center gap-1">
                        {order.customer_type === "insurer" ? (
                          <>
                            {order.insurer_detail?.logo ? (
                              <img src={order.insurer_detail.logo} alt="" className="h-3.5 w-3.5 object-contain" />
                            ) : (
                              <span
                                className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-white text-[7px] font-bold shrink-0"
                                style={{ backgroundColor: order.insurer_detail?.brand_color ?? "#6366f1" }}
                              >
                                {order.insurer_detail?.abbreviation?.charAt(0) ?? "S"}
                              </span>
                            )}
                            {order.insurer_detail?.display_name ?? "Seguradora"}
                          </>
                        ) : (
                          <><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-0.5"></span>Particular</>
                        )}
                      </span>
                    </div>
                  </div>
                </TableCell>

                {/* Veículo */}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-neutral-900 flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5 text-neutral-400" />
                      {order.make} {order.model} {order.year ? `(${order.year})` : ""}
                    </span>
                    <span className="text-xs font-mono text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded w-fit mt-0.5 border border-neutral-200 uppercase">
                      {order.plate || "SEM PLACA"}
                    </span>
                  </div>
                </TableCell>

                {/* Datas */}
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex items-center justify-between gap-2 text-neutral-600">
                      <span className="text-xs text-neutral-400">Entr:</span>
                      <span>{formatDate(order.entry_date)}</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-between gap-2 font-medium",
                      isLate ? "text-error-600" : "text-neutral-700"
                    )}>
                      <span className={cn("text-xs", isLate ? "text-error-500" : "text-neutral-400")}>Prev:</span>
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
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
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
