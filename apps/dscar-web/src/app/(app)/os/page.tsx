"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search, FilterX, Plus, ChevronLeft, ChevronRight, X, SlidersHorizontal, Columns3 } from "lucide-react"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"

import { useServiceOrders, useDebounce, usePersons } from "@/hooks"
import { cn } from "@/lib/utils"
import {
  Button,
  Input,
  TableSkeleton,
  EmptyState,
  Skeleton,
} from "@/components/ui"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PendingDraftsBanner } from "@/components/offline/PendingDraftsBanner"
import { ServiceOrderTable } from "./_components/ServiceOrderTable"
import { NewOSDrawer } from "./_components/NewOSDrawer"

const SELECT_CLS = "h-9 rounded-md border border-border bg-muted/50 px-3 py-1 text-sm text-foreground/70 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
const PAGE_SIZE = 20

interface AdvancedFiltersProps {
  status: string
  setStatus: (v: string) => void
  insurerId: string
  setInsurerId: (v: string) => void
  insurers?: { id: string | number; fantasy_name?: string | null; full_name?: string | null }[]
  customerType: string
  setCustomerType: (v: string) => void
  closure: string
  setClosure: (v: string) => void
  /** Empilhado e com alvo de 44px — usado dentro da folha mobile. */
  stacked?: boolean
}

/** Os quatro filtros secundarios. Inline no desktop, dentro da folha no mobile. */
function AdvancedFilters({
  status,
  setStatus,
  insurerId,
  setInsurerId,
  insurers,
  customerType,
  setCustomerType,
  closure,
  setClosure,
  stacked = false,
}: AdvancedFiltersProps): React.ReactElement {
  const cls = stacked ? cn(SELECT_CLS, "h-11 w-full") : SELECT_CLS
  const field = (label: string, node: React.ReactNode) =>
    stacked ? (
      <label className="block space-y-1">
        <span className="label-mono">{label}</span>
        {node}
      </label>
    ) : (
      node
    )

  return (
    <>
      {field(
        "Status",
        <select className={cls} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">Todos os status</option>
          <option value="reception">Recepção</option>
          <option value="initial_survey">Vistoria Inicial</option>
          <option value="budget">Orçamento</option>
          <option value="waiting_auth">Aguardando Aprovação</option>
          <option value="authorized">Autorizada</option>
          <option value="waiting_parts">Aguardando Peças</option>
          <option value="repair">Em Reparo</option>
          <option value="mechanic">Mecânica</option>
          <option value="bodywork">Funilaria</option>
          <option value="painting">Pintura</option>
          <option value="assembly">Montagem</option>
          <option value="polishing">Polimento</option>
          <option value="washing">Lavagem</option>
          <option value="final_survey">Vistoria Final</option>
          <option value="ready">Pronto p/ Entrega</option>
          <option value="delivered">Entregue</option>
          <option value="cancelled">Cancelada</option>
        </select>,
      )}

      {field(
        "Seguradora",
        <select className={cls} value={insurerId} onChange={(e) => setInsurerId(e.target.value)}>
          <option value="ALL">Qualquer Seguradora</option>
          {insurers?.map((insurer) => (
            <option key={insurer.id} value={String(insurer.id)}>
              {insurer.fantasy_name || insurer.full_name}
            </option>
          ))}
        </select>,
      )}

      {field(
        "Tipo de cliente",
        <select className={cls} value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
          <option value="ALL">Qualquer Tipo</option>
          <option value="insurer">Seguradora</option>
          <option value="private">Particular</option>
        </select>,
      )}

      {field(
        "Fechamento",
        <select className={cls} value={closure} onChange={(e) => setClosure(e.target.value)}>
          <option value="ALL">Qualquer fechamento</option>
          <option value="closed">Fechadas</option>
          <option value="pending">Pendentes</option>
        </select>,
      )}
    </>
  )
}

export default function ServiceOrdersPage() {
  const searchParams = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(searchParams.get("nova") === "1")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("ALL")
  const [customerType, setCustomerType] = useState<string>("ALL")
  const [insurerId, setInsurerId] = useState<string>("ALL")
  const [ordering, setOrdering] = useState<string>("-number")
  const [excludeClosed, setExcludeClosed] = useState(true)
  const [closure, setClosure] = useState<string>("ALL")
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Quantos dos 4 filtros secundarios estao ativos — vira o badge do botao "Filtros".
  const advancedCount = [status, insurerId, customerType, closure].filter((v) => v !== "ALL").length

  const debouncedSearch = useDebounce(search, 300)

  // Fetch seguradoras dynamically
  const { data: insurersData } = usePersons({ role: "INSURER" })

  // Omit empty/ALL filters
  const filters: Record<string, string> = {}
  if (debouncedSearch) filters.search = debouncedSearch
  if (status !== "ALL") filters.status = status
  if (customerType !== "ALL") filters.customer_type = customerType
  if (insurerId !== "ALL") filters.insurer = insurerId
  if (ordering) filters.ordering = ordering
  if (excludeClosed && status === "ALL") filters.exclude_closed = "true"
  if (closure !== "ALL") filters.closure = closure

  const { data, isLoading, isError } = useServiceOrders(filters, page, PAGE_SIZE)

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, customerType, insurerId, ordering, excludeClosed, closure])

  const clearFilters = () => {
    setSearch("")
    setStatus("ALL")
    setCustomerType("ALL")
    setInsurerId("ALL")
    setExcludeClosed(true)
    setClosure("ALL")
  }

  const hasFilters = search || status !== "ALL" || customerType !== "ALL" || insurerId !== "ALL" || !excludeClosed || closure !== "ALL"

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0
  const firstItem = data && data.count > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const lastItem = data ? Math.min(page * PAGE_SIZE, data.count) : 0

  return (
    <div className="flex flex-col gap-4 md:gap-6 px-0 py-3 md:p-6 max-w-7xl mx-auto">
      <NewOSDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      {/* Cabecalho proprio (nao o PageHeader compartilhado): esta tela tem
          contagem + alternador de visao, e a 390px o bloco de 3 linhas do
          PageHeader empurrava a primeira OS pra fora da tela. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate text-base font-semibold text-foreground md:text-2xl">
            Ordens de Serviço
          </h2>
          {data && (
            <span className="label-mono shrink-0 tabular-nums">
              {data.count} {data.count === 1 ? "OS" : "OS"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3">
            <Link
              href="/os/kanban"
              title="Ver Kanban"
              aria-label="Ver Kanban"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-muted/50 text-sm font-medium text-foreground/70 hover:bg-muted/30 md:h-auto md:w-auto md:px-4 md:py-2"
            >
              <Columns3 className="h-4 w-4 md:hidden" />
              <span className="hidden md:inline">Ver Kanban</span>
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm md:min-h-0 md:px-4 md:py-2"
            >
              <Plus className="h-4 w-4" />
              Nova OS
            </button>
        </div>
      </div>

      <PendingDraftsBanner />

      {/* Filter Bar */}
      <div className="bg-muted/50 p-4 rounded-md border border-border shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar OS (ex: placa, num, cliente)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 pl-9 bg-muted/50 md:h-9"
          />
        </div>

        {/* Mobile: escopo segmentado + folha de filtros. Empilhar 5 controles em
            largura cheia empurrava a primeira OS pra fora da tela. */}
        <div className="flex gap-2 md:hidden">
          <div className="flex min-w-0 flex-1 rounded-md border border-border bg-background p-0.5">
            {([true, false] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setExcludeClosed(v)}
                aria-pressed={excludeClosed === v}
                className={cn(
                  "min-h-[44px] flex-1 rounded-[5px] px-2 text-sm font-medium transition-colors",
                  excludeClosed === v
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v ? "Na Oficina" : "Todas"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
              advancedCount > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background text-foreground/70",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {advancedCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {advancedCount}
              </span>
            )}
          </button>
        </div>

        <div className="hidden md:flex md:flex-row gap-3">
          <button
            type="button"
            onClick={() => setExcludeClosed(!excludeClosed)}
            className={cn(
              "h-9 rounded-md border px-3 py-1 text-sm font-medium shadow-sm transition-colors whitespace-nowrap",
              excludeClosed
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-muted/50 text-foreground/70 hover:bg-muted/30"
            )}
          >
            {excludeClosed ? "Na Oficina" : "Todas"}
          </button>

          <AdvancedFilters
            status={status}
            setStatus={setStatus}
            insurerId={insurerId}
            setInsurerId={setInsurerId}
            insurers={insurersData?.results}
            customerType={customerType}
            setCustomerType={setCustomerType}
            closure={closure}
            setClosure={setClosure}
          />

          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground hover:text-error-600 px-3">
              <FilterX className="h-4 w-4 mr-2" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: os mesmos selects, numa folha — fora do caminho até serem pedidos */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col md:hidden">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            <AdvancedFilters
              stacked
              status={status}
              setStatus={setStatus}
              insurerId={insurerId}
              setInsurerId={setInsurerId}
              insurers={insurersData?.results}
              customerType={customerType}
              setCustomerType={setCustomerType}
              closure={closure}
              setClosure={setClosure}
            />
          </div>
          <SheetFooter className="gap-2">
            {advancedCount > 0 && (
              <Button
                variant="outline"
                className="min-h-[44px] flex-1"
                onClick={() => {
                  setStatus("ALL")
                  setInsurerId("ALL")
                  setCustomerType("ALL")
                  setClosure("ALL")
                }}
              >
                <FilterX className="mr-2 h-4 w-4" /> Limpar
              </Button>
            )}
            <Button className="min-h-[44px] flex-1" onClick={() => setFiltersOpen(false)}>
              Ver resultados
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {search && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-foreground/80">
              Busca: &quot;{search}&quot;
              <button type="button" onClick={() => setSearch("")} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors" aria-label="Remover filtro de busca">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {status !== "ALL" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-foreground/80">
              Status: {SERVICE_ORDER_STATUS_CONFIG[status as keyof typeof SERVICE_ORDER_STATUS_CONFIG]?.label ?? status}
              <button type="button" onClick={() => setStatus("ALL")} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors" aria-label="Remover filtro de status">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {insurerId !== "ALL" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-foreground/80">
              Seguradora: {insurersData?.results.find((i) => String(i.id) === insurerId)?.fantasy_name ?? insurerId}
              <button type="button" onClick={() => setInsurerId("ALL")} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors" aria-label="Remover filtro de seguradora">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {customerType !== "ALL" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-foreground/80">
              Tipo: {customerType === "insurer" ? "Seguradora" : "Particular"}
              <button type="button" onClick={() => setCustomerType("ALL")} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors" aria-label="Remover filtro de tipo">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {!excludeClosed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-foreground/80">
              Mostrando todas (incluindo entregues)
              <button type="button" onClick={() => setExcludeClosed(true)} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors" aria-label="Voltar para na oficina">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {closure !== "ALL" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-3 py-1 text-xs font-medium text-foreground/80">
              {closure === "closed" ? "Fechadas" : "Pendentes"}
              <button type="button" onClick={() => setClosure("ALL")} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors" aria-label="Remover filtro de fechamento">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
         {isLoading && (
           <>
             <div className="md:hidden space-y-2">
               {Array.from({ length: 6 }).map((_, i) => (
                 <div key={i} className="rounded-[11px] bg-card px-3 py-2.5 space-y-1.5">
                   <div className="flex items-center justify-between gap-2">
                     <Skeleton className="h-3.5 w-24" />
                     <Skeleton className="h-3 w-16" />
                   </div>
                   <Skeleton className="h-3.5 w-3/4" />
                   <div className="grid grid-cols-[minmax(0,1fr)_88px_78px] gap-2.5">
                     <Skeleton className="h-3 w-20" />
                     <Skeleton className="h-3 w-16 justify-self-end" />
                     <Skeleton className="h-3 w-12 justify-self-end" />
                   </div>
                 </div>
               ))}
             </div>
             <div className="hidden md:block">
               <TableSkeleton columns={6} rows={8} />
             </div>
           </>
         )}

         {isError && (
           <EmptyState
             title="Erro ao carregar Ordens de Serviço"
             description="Tente recarregar a página."
             className="bg-muted/50 border rounded-md"
           />
         )}

         {!isLoading && !isError && data && (
           <>
             {data.results.length === 0 ? (
               <EmptyState
                 title="Nenhuma Ordem de Serviço encontrada"
                 description={hasFilters ? "Tente ajustar ou limpar seus filtros." : "O sistema ainda não possui ordens de serviço."}
                 className="bg-muted/50 border rounded-md"
               />
             ) : (
               <>
                 <ServiceOrderTable orders={data.results} ordering={ordering} onOrderingChange={setOrdering} />

                 {/* Pagination */}
                 {data.count > 0 && (
                   <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                     <p className="text-xs text-muted-foreground">
                       {firstItem}–{lastItem} de {data.count} registro{data.count !== 1 ? "s" : ""}
                     </p>
                     {totalPages > 1 && (
                       <div className="flex items-center gap-1">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => setPage((p) => Math.max(1, p - 1))}
                           disabled={page === 1}
                           className="h-8 px-2 text-foreground/60"
                         >
                           <ChevronLeft className="h-4 w-4 mr-1" />
                           Anterior
                         </Button>
                         <span className="text-xs text-foreground/60 px-2">
                           {page} / {totalPages}
                         </span>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                           disabled={page === totalPages}
                           className="h-8 px-2 text-foreground/60"
                         >
                           Próxima
                           <ChevronRight className="h-4 w-4 ml-1" />
                         </Button>
                       </div>
                     )}
                   </div>
                 )}
               </>
             )}
           </>
         )}
      </div>
    </div>
  )
}
