"use client"

/**
 * Visão Geral da OS (v2) — landing da tela: identidade, financeiro,
 * pendências acionáveis e atividade recente num só lugar.
 */

import Link from "next/link"
import type { Route } from "next"
import {
  Car,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  User,
  Wrench,
} from "lucide-react"
import type { ServiceOrder } from "@paddock/types"
import { formatCurrency } from "@paddock/utils"
import { TransitionRequirementsPanel } from "../_components/TransitionRequirementsPanel"

interface OverviewSectionProps {
  order: ServiceOrder
  onNavigate: (section: string) => void
}

export function OverviewSection({ order, onNavigate }: OverviewSectionProps) {
  const partsTotal = Number(order.parts_total ?? 0)
  const servicesTotal = Number(order.services_total ?? 0)
  const total = partsTotal + servicesTotal

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Coluna principal */}
      <div className="space-y-4 lg:col-span-2">
        {/* Cliente & veículo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoCard
            icon={<User className="h-4 w-4" />}
            title="Cliente"
            action={
              order.customer_person_id != null ? (
                <Link
                  href={`/cadastros/${order.customer_person_id}` as Route}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Ver cadastro <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null
            }
          >
            <p className="text-sm font-medium text-foreground">{order.customer_name || "—"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {order.customer_type === "insurer" ? "Seguradora" : "Particular"}
              {order.insurer_detail?.name ? ` · ${order.insurer_detail.name}` : ""}
            </p>
          </InfoCard>

          <InfoCard icon={<Car className="h-4 w-4" />} title="Veículo">
            <p className="text-sm font-medium text-foreground">
              {[order.make, order.model].filter(Boolean).join(" ") || "—"}
            </p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5 tracking-wider">
              {order.plate || "sem placa"}
              {order.color ? ` · ${order.color}` : ""}
              {order.year ? ` · ${order.year}` : ""}
            </p>
          </InfoCard>
        </div>

        {/* Pendências / transição — motor existente, casca nova */}
        <div className="rounded-xl border border-border bg-card/50">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Próximo passo</h3>
          </div>
          <div className="p-4">
            <TransitionRequirementsPanel order={order} />
          </div>
        </div>
      </div>

      {/* Coluna lateral */}
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card/50">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Financeiro</h3>
          </div>
          <div className="space-y-2 p-4">
            <MoneyRow label="Peças" value={partsTotal} onClick={() => onNavigate("parts")} />
            <MoneyRow label="Serviços" value={servicesTotal} onClick={() => onNavigate("services")} />
            <div className="border-t border-border pt-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Ações rápidas</h3>
          </div>
          <div className="grid grid-cols-1 gap-1.5 p-3">
            <QuickAction label="Adicionar peça" onClick={() => onNavigate("parts")} />
            <QuickAction label="Adicionar serviço" onClick={() => onNavigate("services")} />
            <QuickAction label="Faturar / emitir NF" onClick={() => onNavigate("closing")} />
            <QuickAction label="Ver histórico" onClick={() => onNavigate("activity")} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Building blocks ─────────────────────────────────────────────────── */

function InfoCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function MoneyRow({
  label,
  value,
  onClick,
}: {
  label: string
  value: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-1 py-0.5 text-left transition-colors hover:bg-muted/40"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs text-foreground/80">{formatCurrency(value)}</span>
    </button>
  )
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      {label}
    </button>
  )
}
