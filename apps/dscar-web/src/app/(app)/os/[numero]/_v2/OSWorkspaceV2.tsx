"use client"

/**
 * OS Workspace v2 — shell novo da tela de OS.
 *
 * Header compacto com identidade da OS + stepper de fases, navegação
 * lateral agrupada e conteúdo em largura total. As seções reusam os
 * componentes de dados existentes enquanto são redesenhadas em fases.
 */

import { Suspense, lazy, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Boxes,
  CircleDollarSign,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Wrench,
} from "lucide-react"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG, formatCurrency } from "@paddock/utils"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { PIPELINE_PHASES, currentPhaseIndex } from "./pipeline"
import { OverviewSection } from "./OverviewSection"
import { DadosWorkspace } from "./dados/DadosWorkspace"
import { PartsTab } from "../_components/tabs/PartsTab"
import { ServicesTab } from "../_components/tabs/ServicesTab"

const ClosingTab = lazy(() =>
  import("../_components/tabs/ClosingTab").then((m) => ({ default: m.ClosingTab })),
)
const HistoryTab = lazy(() =>
  import("../_components/tabs/HistoryTab").then((m) => ({ default: m.HistoryTab })),
)
const NotesTab = lazy(() =>
  import("../_components/tabs/NotesTab").then((m) => ({ default: m.NotesTab })),
)
const RemindersTab = lazy(() =>
  import("../_components/tabs/RemindersTab").then((m) => ({ default: m.RemindersTab })),
)
const FilesTab = lazy(() =>
  import("../_components/tabs/FilesTab").then((m) => ({ default: m.FilesTab })),
)
const EstoqueTab = lazy(() =>
  import("@/components/os/EstoqueTab").then((m) => ({ default: m.EstoqueTab })),
)

type SectionId =
  | "overview"
  | "dados"
  | "parts"
  | "services"
  | "closing"
  | "activity"
  | "files"
  | "estoque"

type ActivityView = "history" | "notes" | "reminders"

const NAV: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Visão Geral", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "dados", label: "Dados", icon: <FileText className="h-4 w-4" /> },
  { id: "parts", label: "Peças", icon: <Package className="h-4 w-4" /> },
  { id: "services", label: "Serviços", icon: <Wrench className="h-4 w-4" /> },
  { id: "closing", label: "Fechamento", icon: <CircleDollarSign className="h-4 w-4" /> },
  { id: "activity", label: "Atividade", icon: <MessageSquareText className="h-4 w-4" /> },
  { id: "files", label: "Arquivos", icon: <FolderOpen className="h-4 w-4" /> },
  { id: "estoque", label: "Estoque", icon: <Boxes className="h-4 w-4" /> },
]

interface OSWorkspaceV2Props {
  order: ServiceOrder
}

export function OSWorkspaceV2({ order }: OSWorkspaceV2Props) {
  const router = useRouter()
  const [section, setSection] = useState<SectionId>("overview")
  const [activityView, setActivityView] = useState<ActivityView>("history")

  const status = order.status as ServiceOrderStatus
  const statusCfg = SERVICE_ORDER_STATUS_CONFIG[status]
  const phaseIdx = currentPhaseIndex(status)
  const isCancelled = status === "cancelled"

  const total = Number(order.parts_total ?? 0) + Number(order.services_total ?? 0)
  const vehicle = [order.make, order.model].filter(Boolean).join(" ")

  const pendingCount =
    (order.allowed_transitions ?? []).length > 0
      ? (order.transition_requirements?.[order.allowed_transitions![0]]?.hard_blocks?.length ?? 0)
      : 0

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="md:sticky md:top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="px-5 pt-2.5">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <li>
              <a href="/os" className="transition-colors hover:text-foreground">
                Ordens de Serviço
              </a>
            </li>
            <li aria-hidden>/</li>
            <li className="text-foreground/70">OS #{order.number}</li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 pt-1">
          <button
            type="button"
            onClick={() => router.push("/os")}
            aria-label="Voltar para a lista"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            OS #{order.number}
          </h1>
          <span
            className={cn(
              "whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusCfg?.badge ?? "bg-muted text-muted-foreground",
            )}
          >
            {statusCfg?.label ?? status}
          </span>

          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setSection("overview")}
              className="rounded-full border border-warning-500/30 bg-warning-500/10 px-2.5 py-0.5 text-xs text-warning-400 transition-colors hover:bg-warning-500/20"
            >
              {pendingCount} pendência{pendingCount > 1 ? "s" : ""}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <a
              href={`/os/${order.number}/classic`}
              className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <FileText className="mr-1.5 inline h-3.5 w-3.5" />
              <span className="hidden sm:inline">Versão clássica</span>
              <span className="sm:hidden">Clássica</span>
            </a>
          </div>
        </div>

        {/* Identidade + stepper */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 pb-3 pt-1.5">
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground/80">{order.customer_name || "Sem cliente"}</span>
            {vehicle && <span> · {vehicle}</span>}
            {order.plate && <span className="font-mono tracking-wider"> · {order.plate}</span>}
            <span className="font-mono"> · {formatCurrency(total)}</span>
          </p>

          {!isCancelled && (
            <ol className="ml-auto flex max-w-full items-center gap-1.5 overflow-x-auto" aria-label="Progresso da OS">
              {PIPELINE_PHASES.map((phase, i) => {
                const state = i < phaseIdx ? "done" : i === phaseIdx ? "current" : "todo"
                return (
                  <li key={phase.key} className="flex items-center gap-1.5">
                    {i > 0 && <span className="h-px w-4 bg-border" />}
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[11px]",
                        state === "current"
                          ? "text-foreground font-medium"
                          : state === "done"
                            ? "text-success-400"
                            : "text-muted-foreground/60",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          state === "current"
                            ? (statusCfg?.dot ?? "bg-primary")
                            : state === "done"
                              ? "bg-success-500"
                              : "bg-muted",
                        )}
                      />
                      {phase.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </header>

      {/* ── Corpo: nav lateral (md+) ou tabs horizontais (mobile) ───── */}
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Mesma linguagem do Sidebar global: barra ativa de 3px + label mono */}
        <nav className="hidden w-44 shrink-0 border-r border-border bg-background py-3 md:block" aria-label="Seções da OS">
          <p className="px-5 pb-1.5 font-mono text-[9.5px] uppercase tracking-[1.5px] text-muted-foreground">
            Seções
          </p>
          <ul>
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={section === item.id ? "page" : undefined}
                  className={cn(
                    "relative flex w-full items-center gap-2.5 px-5 py-2 text-sm transition-colors",
                    section === item.id
                      ? "bg-muted/30 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                  )}
                >
                  {section === item.id && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-primary" />
                  )}
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile: seções como tabs roláveis, indicador embaixo */}
        <nav className="overflow-x-auto border-b border-border bg-background md:hidden" aria-label="Seções da OS">
          <ul className="flex w-max px-2">
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={section === item.id ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs transition-[transform,color,border-color] duration-150 ease-out active:scale-[0.97]",
                    section === item.id
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 px-4 py-4 md:px-5 md:py-5">
          {section === "overview" && <OverviewSection order={order} onNavigate={(s) => setSection(s as SectionId)} />}
          {section === "dados" && <DadosWorkspace order={order} />}
          {section === "parts" && <PartsTab orderId={order.id} />}
          {section === "services" && <ServicesTab osId={order.id} osStatus={status} />}

          {section === "activity" && (
            <div className="space-y-4">
              <div className="flex gap-1 rounded-lg border border-border bg-muted/20 p-1 w-fit">
                {(
                  [
                    ["history", "Histórico"],
                    ["notes", "Observações"],
                    ["reminders", "Lembretes"],
                  ] as [ActivityView, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActivityView(id)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs transition-colors",
                      activityView === id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                {activityView === "history" && <HistoryTab order={order} />}
                {activityView === "notes" && (
                  <NotesTab orderId={order.id} initialNotes={order.notes} />
                )}
                {activityView === "reminders" && <RemindersTab orderId={order.id} />}
              </Suspense>
            </div>
          )}

          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            {section === "closing" && <ClosingTab order={order} />}
            {section === "files" && <FilesTab order={order} />}
            {section === "estoque" && <EstoqueTab osId={order.id} />}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
