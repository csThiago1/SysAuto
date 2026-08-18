"use client"

/**
 * Histórico de atendimentos — por cliente ou por veículo (placa).
 *
 * Modo cliente: agrupa as OS por placa ("Veículos").
 * Modo placa:   agrupa as OS por cliente ("Clientes" — o carro pode ter trocado de dono).
 *
 * Clicar num cartão filtra a lista de OS abaixo.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Car, DollarSign, FileText, Calendar, User } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
  Skeleton,
} from "@/components/ui"
import { formatCurrency, formatDate, formatOSNumber } from "@paddock/utils"
import { useHistoricoOrders } from "@/hooks"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"
import { cn } from "@/lib/utils"

export interface HistoricoAtendimentosProps {
  /** Histórico do cliente — todas as OS dele, de todos os veículos. */
  customerId?: string
  /** Histórico do veículo — todas as OS da placa, de todos os donos. */
  plate?: string
  /** OS a destacar na lista (a que o usuário está vendo). */
  highlightOrderId?: string
}

interface GroupCard {
  key: string
  title: string
  subtitle: string
  logo: string | null
  osCount: number
  totalSpent: number
}

/**
 * Chave de agrupamento por cliente.
 *
 * Atenção: no JSON, `os.customer` é o customer_uuid (o serializer sobrescreve o
 * campo), não o PK da Person. Quem identifica a pessoa é `customer_person_id`.
 */
function customerKey(os: ServiceOrder): string {
  return os.customer_person_id != null
    ? String(os.customer_person_id)
    : (os.customer_name ?? "")
}

function orderTotal(os: ServiceOrder): number {
  return (
    Number(os.parts_total ?? 0) +
    Number(os.services_total ?? 0) -
    Number(os.discount_total ?? 0)
  )
}

export function HistoricoAtendimentos({
  customerId,
  plate,
  highlightOrderId,
}: HistoricoAtendimentosProps) {
  const byPlate = !!plate
  const { data, isLoading, isError } = useHistoricoOrders({ customerId, plate })
  const [groupFilter, setGroupFilter] = useState<string>("")

  const orders = useMemo(() => data?.results ?? [], [data])
  const ordersCount = data?.count ?? orders.length

  const summary = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered")
    const totalSpent = delivered.reduce((acc, o) => acc + orderTotal(o), 0)
    const dates = orders
      .map((o) => o.entry_date ?? o.created_at)
      .filter((d): d is string => !!d)
      .sort()

    return {
      totalSpent,
      osCount: ordersCount,
      avgTicket: delivered.length > 0 ? totalSpent / delivered.length : 0,
      firstDate: dates[0] ?? null,
    }
  }, [orders, ordersCount])

  /** Agrupa por placa (modo cliente) ou por cliente (modo placa). */
  const groups = useMemo(() => {
    const map = new Map<string, GroupCard>()

    for (const os of orders) {
      const key = byPlate ? customerKey(os) : (os.plate ?? "")
      if (!key) continue

      const existing = map.get(key)
      if (existing) {
        existing.osCount += 1
        if (os.status === "delivered") existing.totalSpent += orderTotal(os)
        continue
      }

      map.set(
        key,
        byPlate
          ? {
              key,
              title: os.customer_name ?? "Sem cliente",
              subtitle: os.plate ?? "",
              logo: null,
              osCount: 1,
              totalSpent: os.status === "delivered" ? orderTotal(os) : 0,
            }
          : {
              key,
              title: os.plate ?? "",
              subtitle: [os.make, os.model, os.year].filter(Boolean).join(" · "),
              logo: os.make_logo ?? null,
              osCount: 1,
              totalSpent: os.status === "delivered" ? orderTotal(os) : 0,
            }
      )
    }

    return Array.from(map.values())
  }, [orders, byPlate])

  const filteredOrders = useMemo(() => {
    if (!groupFilter) return orders
    return orders.filter((o) =>
      byPlate ? customerKey(o) === groupFilter : o.plate === groupFilter
    )
  }, [orders, groupFilter, byPlate])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Não foi possível carregar o histórico.
      </p>
    )
  }

  if (orders.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum atendimento registrado.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          label={byPlate ? "Primeira Visita" : "Cliente Desde"}
          value={summary.firstDate ? formatDate(summary.firstDate) : "—"}
        />
      </div>

      {/* Agrupamento — veículos (modo cliente) ou clientes (modo placa) */}
      {groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {byPlate ? (
                <User className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Car className="h-4 w-4 text-muted-foreground" />
              )}
              {byPlate ? "Clientes" : "Veículos"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGroupFilter(groupFilter === g.key ? "" : g.key)}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                    groupFilter === g.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  )}
                >
                  {g.logo ? (
                    <img
                      src={g.logo}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded object-contain"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted/50">
                      {byPlate ? (
                        <User className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Car className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        "truncate text-sm font-bold",
                        !byPlate && "font-mono tracking-wider"
                      )}
                    >
                      {g.title}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {g.subtitle}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {g.osCount} OS · {formatCurrency(g.totalSpent)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de OS */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-y-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Ordens de Serviço
            </CardTitle>
            {groupFilter && (
              <button
                type="button"
                onClick={() => setGroupFilter("")}
                className="text-xs text-primary hover:underline"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma OS encontrada.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((os) => (
                <Link
                  key={os.id}
                  href={`/os/${os.number}`}
                  className={cn(
                    "block rounded-md border px-3 py-2.5 transition-colors hover:bg-muted/30",
                    os.id === highlightOrderId
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  )}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_96px_44px] items-center gap-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">
                        OS #{formatOSNumber(os.number)}
                        {os.id === highlightOrderId && (
                          <span className="ml-1.5 text-xs font-normal text-primary">
                            (atual)
                          </span>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {byPlate
                          ? os.customer_name
                          : `${os.plate} · ${os.make ?? ""} ${os.model ?? ""}`}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {os.entry_date ? formatDate(os.entry_date) : "—"}
                        {os.delivered_at ? ` → ${formatDate(os.delivered_at)}` : ""}
                      </span>
                    </div>
                    <span className="text-right font-mono text-sm tabular-nums text-foreground">
                      {formatCurrency(os.total ?? 0)}
                    </span>
                    <div className="flex justify-end">
                      <StatusBadge status={os.status as ServiceOrderStatus} size="sm" />
                    </div>
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
      <CardContent className="pb-3 pt-4">
        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="truncate text-xs font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}
