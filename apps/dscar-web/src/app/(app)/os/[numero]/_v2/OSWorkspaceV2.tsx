"use client"

/**
 * OS Workspace v2 — shell novo da tela de OS.
 *
 * Header compacto com identidade da OS + stepper de fases, navegação
 * lateral agrupada e conteúdo em largura total. As seções reusam os
 * componentes de dados existentes enquanto são redesenhadas em fases.
 */

import { Button } from "@/components/ui/button"
import { Suspense, lazy, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Boxes,
  Camera,
  Upload,
  CircleDollarSign,
  FileText,
  FolderOpen,
  History,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Wrench,
  ReceiptText,
} from "lucide-react"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG, formatCurrency } from "@paddock/utils"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { PlacaMercosul } from "@/components/vehicle/PlacaMercosul"
import { ScrollFade } from "@/components/ui/scroll-fade"
import { PIPELINE_PHASES, currentPhaseIndex } from "./pipeline"
import { OverviewSection } from "./OverviewSection"
import { DocumentsDropdown } from "../_components/DocumentsDropdown"
import { DadosWorkspace } from "./dados/DadosWorkspace"
import { PartsTab } from "../_components/tabs/PartsTab"
import { OrcamentoTab } from "../_components/tabs/OrcamentoTab"
import { useServiceOrder } from "../_hooks/useServiceOrder"
import { ServicesTab } from "../_components/tabs/ServicesTab"

const ImportBudgetModal = lazy(() =>
  import("../_components/ImportBudgetModal").then((m) => ({ default: m.ImportBudgetModal })),
)
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
const HistoricoAtendimentos = lazy(() =>
  import("@/components/historico/HistoricoAtendimentos").then((m) => ({
    default: m.HistoricoAtendimentos,
  })),
)

type SectionId =
  | "overview"
  | "dados"
  | "execucao"
  | "closing"
  | "activity"
  | "historico"
  | "files"

type ExecView = "orcamento" | "parts" | "services" | "estoque"

type ActivityView = "history" | "notes" | "reminders"

/** Abas internas de Histórico: passado deste carro vs. passado deste cliente. */
type HistoricoView = "veiculo" | "cliente"

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
  { id: "execucao", label: "Orçamento", icon: <ReceiptText className="h-4 w-4" /> },
  { id: "closing", label: "Fechamento", icon: <CircleDollarSign className="h-4 w-4" /> },
]

const NAV_SECONDARY: NavItem[] = [
  { id: "activity", label: "Atividade", icon: <MessageSquareText className="h-4 w-4" /> },
  { id: "historico", label: "Histórico", icon: <History className="h-4 w-4" /> },
  { id: "files", label: "Arquivos", icon: <FolderOpen className="h-4 w-4" /> },
]

const NAV = [...NAV_PRIMARY, ...NAV_SECONDARY]

/** Abas internas de Orçamento: a lista única primeiro; o detalhe (margem, reserva) ao lado. */
const EXEC_VIEWS: { id: ExecView; label: string; icon: React.ReactNode }[] = [
  { id: "orcamento", label: "Tudo", icon: <ReceiptText className="h-4 w-4" /> },
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
  const [execView, setExecView] = useState<ExecView>("orcamento")
  const [activityView, setActivityView] = useState<ActivityView>("history")
  const [historicoView, setHistoricoView] = useState<HistoricoView>("veiculo")
  const [importOpen, setImportOpen] = useState(false)

  /**
   * A Visão Geral navega por nomes antigos ("parts", "services", "estoque"),
   * que agora são abas DENTRO de Execução. Antes isso passava por um
   * `as SectionId` — o cast calava o compilador e a área de conteúdo ficava
   * em branco. Aqui o destino é traduzido de verdade.
   */
  function goTo(target: string) {
    if (target === "importar") {
      setImportOpen(true)
      return
    }
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

  // A OS vem do servidor; o total lê a consulta viva para mudar quando o orçamento muda.
  const { data: liveOrder } = useServiceOrder(order.id)
  const totals = liveOrder ?? order
  const total = Number(totals.parts_total ?? 0) + Number(totals.services_total ?? 0)
  const vehicle = [order.make, order.model].filter(Boolean).join(" ")

  const pendingCount =
    (order.allowed_transitions ?? []).length > 0
      ? (order.transition_requirements?.[order.allowed_transitions![0]]?.hard_blocks?.length ?? 0)
      : 0

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      {importOpen && (
        <Suspense fallback={null}>
          <ImportBudgetModal
            order={order}
            open
            onClose={() => {
              setImportOpen(false)
              router.refresh()
            }}
          />
        </Suspense>
      )}
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header ref={headerRef} className="md:sticky md:top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        {/* Torre de tempos: número da OS na faixa vermelha, placa Mercosul,
            carro em condensada, status como faixa da cor da bandeira. */}
        <div className="flex flex-wrap items-stretch gap-y-2 md:flex-nowrap">
          <button
            type="button"
            onClick={() => router.push("/os")}
            aria-label="Voltar para a lista de OS"
            className="flex w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-stretch">
            <h1
              className="page-title flex shrink-0 flex-col justify-center bg-primary py-2 pl-3 pr-6 text-primary-foreground [clip-path:polygon(0_0,100%_0,calc(100%-14px)_100%,0_100%)]"
              aria-label={`OS ${order.number}`}
            >
              <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.12em] opacity-90">OS</span>
              <span className="font-cond text-[40px] font-extrabold leading-[0.9] tabular-nums">{order.number}</span>
            </h1>

            <div className="flex min-w-0 flex-col justify-center gap-1 px-4 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                {order.plate && <PlacaMercosul plate={order.plate} size="md" />}
                <span className="truncate font-cond text-[24px] font-bold uppercase leading-none tracking-[0.01em]">
                  {vehicle || "Veículo sem modelo"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground/90">{order.customer_name || "Sem cliente"}</span>
                <span> · </span>
                <span className="font-mono text-[15px] text-foreground/90">{formatCurrency(total)}</span>
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 border-t border-border px-3 py-2 md:w-auto md:flex-nowrap md:border-l md:border-t-0 md:px-4">
            <span className="flex items-center gap-2 self-stretch pr-2">
              <span aria-hidden className={cn("w-1.5 self-stretch", statusCfg?.dot ?? "bg-muted")} />
              <span className="whitespace-nowrap font-cond text-[20px] font-bold uppercase leading-none">
                {statusCfg?.label ?? status}
              </span>
            </span>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => setSection("overview")}
                className="inline-flex min-h-11 items-center rounded border border-warning-500/40 bg-warning-500/10 px-3 text-sm font-medium text-warning-400 transition-colors hover:bg-warning-500/20 md:min-h-9"
              >
                {pendingCount} pendência{pendingCount > 1 ? "s" : ""}
              </button>
            )}

            <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 md:ml-auto md:flex md:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
                aria-label="Importar orçamento"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden lg:inline">Importar orçamento</span>
              </Button>
              <DocumentsDropdown order={order} />
              <Button asChild size="sm">
                <a href={`/os/${order.number}/checklist`}>
                  <Camera className="h-4 w-4" />
                  Checklist
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Setores da volta: as fases da OS. A atual acende com a cor do status. */}
        {!isCancelled && (
          <ScrollFade>
            <ol className="grid min-w-[520px] grid-cols-5 border-t border-border" aria-label="Progresso da OS">
              {PIPELINE_PHASES.map((phase, i) => {
                const state = i < phaseIdx ? "done" : i === phaseIdx ? "current" : "todo"
                return (
                  <li
                    key={phase.key}
                    aria-current={state === "current" ? "step" : undefined}
                    className={cn(
                      "relative border-r border-border px-3 py-1.5 font-cond text-[15px] font-bold uppercase tracking-[0.02em] last:border-r-0",
                      state === "current"
                        ? "text-foreground"
                        : state === "done"
                          ? "text-foreground/70"
                          : "text-muted-foreground/70",
                    )}
                  >
                    {state === "current" && (
                      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", statusCfg?.dot ?? "bg-primary")} />
                    )}
                    {state === "done" && <span className="sr-only">Concluída: </span>}
                    {phase.label}
                  </li>
                )
              })}
            </ol>
          </ScrollFade>
        )}
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
                  {execView === "orcamento" && <OrcamentoTab osId={order.id} osStatus={status} />}
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

            {section === "historico" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1">
                  {(
                    [
                      ["veiculo", "Este veículo"],
                      ["cliente", "Este cliente"],
                    ] as [HistoricoView, string][]
                  ).map(([id, label]) => {
                    // Sem Person vinculada (OS de seguradora), só o veículo tem histórico.
                    const disabled = id === "cliente" && order.customer_person_id == null
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setHistoricoView(id)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs transition-colors",
                          disabled && "cursor-not-allowed opacity-40",
                          historicoView === id && !disabled
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                  {historicoView === "veiculo" && order.plate && (
                    <HistoricoAtendimentos plate={order.plate} highlightOrderId={order.id} />
                  )}
                  {historicoView === "cliente" && order.customer_person_id != null && (
                    <HistoricoAtendimentos
                      customerId={String(order.customer_person_id)}
                      highlightOrderId={order.id}
                    />
                  )}
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
