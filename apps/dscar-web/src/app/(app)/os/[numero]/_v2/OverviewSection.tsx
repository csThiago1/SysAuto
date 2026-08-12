"use client"

/**
 * Visão Geral da OS (v2) — landing da tela: identidade, financeiro,
 * pendências acionáveis e atividade recente num só lugar.
 */

import Link from "next/link"
import type { Route } from "next"
import {
  CalendarClock,
  Car,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  Images,
  User,
  Wrench,
} from "lucide-react"
import type { PersonContact, ServiceOrder, ServiceOrderPhoto } from "@paddock/types"
import { formatCurrency, formatDate } from "@paddock/utils"
import { TransitionRequirementsPanel } from "../_components/TransitionRequirementsPanel"
import { useOSPhotos } from "../_hooks/useOSItems"
import { usePerson } from "@/hooks/usePersons"

/** Telefone preferido pra contato: WhatsApp > celular > comercial. */
function pickPhone(contacts: PersonContact[] | undefined): PersonContact | null {
  if (!contacts?.length) return null
  for (const type of ["WHATSAPP", "CELULAR", "COMERCIAL"] as const) {
    const found =
      contacts.find((c) => c.contact_type === type && c.is_primary) ??
      contacts.find((c) => c.contact_type === type)
    if (found?.value) return found
  }
  return null
}

/** wa.me exige só dígitos com DDI — prefixa 55 em números nacionais. */
function whatsappHref(phone: string): string {
  let digits = phone.replace(/\D/g, "")
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`
  }
  return `https://wa.me/${digits}`
}

interface OverviewSectionProps {
  order: ServiceOrder
  onNavigate: (section: string) => void
}

export function OverviewSection({ order, onNavigate }: OverviewSectionProps) {
  const partsTotal = Number(order.parts_total ?? 0)
  const servicesTotal = Number(order.services_total ?? 0)
  const total = partsTotal + servicesTotal

  const { data: photos = [] } = useOSPhotos(order.id)
  const recentPhotos = (photos as ServiceOrderPhoto[])
    .filter((p) => p.is_active && p.url)
    .slice(0, 4)

  const { data: person } = usePerson(order.customer_person_id)
  const phone = pickPhone(person?.contacts)

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
            {phone && (
              <a
                href={whatsappHref(phone.value)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-success-500/30 bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-400 transition-colors hover:bg-success-500/20"
                aria-label={`Abrir WhatsApp com ${order.customer_name}`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 7 2.9 9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.88-9.9 9.88m8.42-18.3A11.8 11.8 0 0 0 12.05 0C5.5 0 .16 5.34.15 11.89c0 2.1.55 4.14 1.59 5.94L.05 24l6.33-1.66a11.88 11.88 0 0 0 5.66 1.44h.01c6.55 0 11.89-5.34 11.9-11.9a11.82 11.82 0 0 0-3.48-8.4" />
                </svg>
                {phone.value}
              </a>
            )}
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

        {/* Prazos */}
        <InfoCard icon={<CalendarClock className="h-4 w-4" />} title="Prazos">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DateItem label="Entrada" value={formatDate(order.entry_date ?? order.created_at)} />
            <DateItem
              label="Previsão de entrega"
              value={order.estimated_delivery_date ? formatDate(order.estimated_delivery_date) : "—"}
              highlight={!!order.estimated_delivery_date}
            />
            <DateItem
              label="Retirada"
              value={order.client_delivery_date ? formatDate(order.client_delivery_date) : "—"}
            />
          </div>
        </InfoCard>

        {/* Pendências / transição — motor existente, casca nova */}
        <div className="rounded-xl border border-border bg-card shadow-card">
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
        <div className="rounded-xl border border-border bg-card shadow-card">
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

        {recentPhotos.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Images className="h-4 w-4" />
                <h3 className="text-sm font-medium text-foreground">Fotos</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("files")}
                className="text-xs text-primary hover:underline"
              >
                Ver todas
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 p-3">
              {recentPhotos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onNavigate("files")}
                  className="aspect-square overflow-hidden rounded-md border border-border"
                  aria-label="Abrir arquivos da OS"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url ?? ""} alt={p.caption || "Foto"} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card shadow-card">
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
    <div className="rounded-xl border border-border bg-card shadow-card">
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

function DateItem({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${highlight ? "text-foreground" : "text-foreground/70"}`}>
        {value}
      </p>
    </div>
  )
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-left text-xs text-foreground/80 transition-[transform,background-color,border-color] duration-150 ease-out hover:border-primary/40 hover:bg-muted/40 active:scale-[0.98]"
    >
      {label}
    </button>
  )
}
