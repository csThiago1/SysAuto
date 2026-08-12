"use client"

/**
 * OS Workspace v2 — shell novo da tela de OS.
 *
 * Header compacto com identidade da OS + stepper de fases, navegação
 * lateral agrupada e conteúdo em largura total. As seções reusam os
 * componentes de dados existentes enquanto são redesenhadas em fases.
 */

import { Suspense, lazy, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Boxes,
  Camera,
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
import { ScrollFade } from "@/components/ui/scroll-fade"
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

type SectionId = "overview" | "dados" | "execucao" | "closing" | "activity" | "files"

type ExecView = "parts" | "services" | "estoque"

type ActivityView = "history" | "notes" | "reminders"

/**
 * Oito seções eram oito decisões a cada visita. Peças, Serviços e Estoque
 * respondem à mesma pergunta — "o que vai no carro e quanto custa" — então
 * viraram uma só, com abas internas. Atividade e Arquivos são consulta, não
 * fluxo de trabalho, e recuam para um grupo secundário.
 */
type NavItem = { id: SectionId; label: string; icon: React.ReactNode }

const NAV_PRIMARY: NavItem[] = [
  { id: "overview", label: "Visão Geral", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "dados", label: "Dados", icon: <FileText className="h-4 w-4" /> },
  { id: "execucao", label: "Execução", icon: <Wrench className="h-4 w-4" /> },
  { id: "closing", label: "Fechamento", icon: <CircleDollarSign className="h-4 w-4" /> },
]

const NAV_SECONDARY: NavItem[] = [
  { id: "activity", label: "Atividade", icon: <MessageSquareText className="h-4 w-4" /> },
  { id: "files", label: "Arquivos", icon: <FolderOpen className="h-4 w-4" /> },
]

const NAV = [...NAV_PRIMARY, ...NAV_SECONDARY]

/** Abas internas de Execução. */
const EXEC_VIEWS: { id: ExecView; label: string; icon: React.ReactNode }[] = [
  { id: "parts", label: "Peças", icon: <Package className="h-4 w-4" /> },
  { id: "services", label: "Serviços", icon: <Wrench className="h-4 w-4" /> },
  { id: "estoque", label: "Estoque", icon: <Boxes className="h-4 w-4" /> },
]

interface OSWorkspaceV2Props {
  order: ServiceOrder
}

/** Lista de seções do rail lateral — mesma linguagem do Sidebar global. */
function NavList({
  items,
  section,
  onSelect,
}: {
  items: NavItem[]
  section: SectionId
  onSelect: (id: SectionId) => void
}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item.id)}
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
  )
}

export function OSWorkspaceV2({ order }: OSWorkspaceV2Props) {
  const router = useRouter()
  const [section, setSection] = useState<SectionId>("overview")
  const [execView, setExecView] = useState<ExecView>("parts")
  const [activityView, setActivityView] = useState<ActivityView>("history")

  /**
   * A Visão Geral navega por nomes antigos ("parts", "services", "estoque"),
   * que agora são abas DENTRO de Execução. Antes isso passava por um
   * `as SectionId` — o cast calava o compilador e a área de conteúdo ficava
   * em branco. Aqui o destino é traduzido de verdade.
   */
  function goTo(target: string) {
    const exec = EXEC_VIEWS.find((v) => v.id === target)
    if (exec) {
      setExecView(exec.id)
      setSection("execucao")
      return
    }
    if (NAV.some((n) => n.id === target)) setSection(target as SectionId)
  }

  // A nav lateral precisa colar logo ABAIXO do header sticky. A altura dele
  // varia (chip de pendências, trilha que quebra em duas linhas), entao e
  // medida em vez de chumbada — numero magico aqui volta a esconder itens.
  const headerRef = useRef<HTMLElement>(null)
  const [headerH, setHeaderH] = useState(0)
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setHeaderH(entry.contentRect.height))
    ro.observe(el)
    setHeaderH(el.getBoundingClientRect().height)
    return () => ro.disconnect()
  }, [])

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
      <header ref={headerRef} className="md:sticky md:top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
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
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground md:-ml-1.5 md:h-9 md:w-9"
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
              className="inline-flex min-h-[44px] items-center rounded-full border border-warning-500/30 bg-warning-500/10 px-3 text-xs text-warning-400 transition-colors hover:bg-warning-500/20 md:min-h-0 md:px-2.5 md:py-0.5"
            >
              {pendingCount} pendência{pendingCount > 1 ? "s" : ""}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <a
              href={`/os/${order.number}/vistoria`}
              className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:min-h-0 md:px-3 md:py-1.5"
            >
              <Camera className="mr-1.5 inline h-3.5 w-3.5" />
              Vistoria
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
            <ScrollFade className="ml-auto max-w-full">
            <ol className="flex items-center gap-1.5" aria-label="Progresso da OS">
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
            </ScrollFade>
          )}
        </div>
      </header>

      {/* ── Corpo: nav lateral (md+) ou tabs horizontais (mobile) ───── */}
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Mesma linguagem do Sidebar global: barra ativa de 3px + label mono */}
        {/* Sticky junto com o header: sem isso a nav rolava POR BAIXO dele e os
            primeiros itens (Visão Geral, Dados, Peças) ficavam inacessíveis
            exatamente quando o usuário rolava para editar. */}
        <nav
          className="hidden w-44 shrink-0 self-start overflow-y-auto border-r border-border bg-background py-3 md:sticky md:block"
          style={{ top: headerH, maxHeight: `calc(100vh - ${headerH}px)` }}
          aria-label="Seções da OS"
        >
          <NavList items={NAV_PRIMARY} section={section} onSelect={setSection} />
          {/* Consulta, não fluxo de trabalho — separado por uma régua para não
              competir com as quatro decisões principais. */}
          <div className="my-2 border-t border-border" />
          <NavList items={NAV_SECONDARY} section={section} onSelect={setSection} />
        </nav>

        {/* Mobile: seções como tabs roláveis, indicador embaixo */}
        <nav className="border-b border-border bg-background md:hidden" aria-label="Seções da OS">
          <ScrollFade>
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
          </ScrollFade>
        </nav>

        <main className="min-w-0 flex-1 px-4 py-4 md:px-5 md:py-5">
          <div key={section} className="animate-section-in">
            {section === "overview" && <OverviewSection order={order} onNavigate={goTo} />}
            {section === "dados" && <DadosWorkspace order={order} />}

            {section === "execucao" && (
              <div className="space-y-4">
                {/* Segmentado interno: Peças, Serviços e Estoque são o mesmo
                    assunto visto de três ângulos, não três destinos. */}
                <div className="flex w-fit gap-1 rounded-lg border border-border bg-muted/20 p-1">
                  {EXEC_VIEWS.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setExecView(v.id)}
                      aria-current={execView === v.id ? "true" : undefined}
                      className={cn(
                        "inline-flex min-h-[38px] items-center gap-1.5 rounded-md px-3 text-xs transition-colors",
                        execView === v.id
                          ? "bg-background font-medium text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {v.icon}
                      {v.label}
                    </button>
                  ))}
                </div>

                <div key={execView} className="animate-section-in">
                  {execView === "parts" && <PartsTab orderId={order.id} />}
                  {execView === "services" && <ServicesTab osId={order.id} osStatus={status} />}
                  {execView === "estoque" && (
                    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                      <EstoqueTab osId={order.id} />
                    </Suspense>
                  )}
                </div>
              </div>
            )}

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
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
