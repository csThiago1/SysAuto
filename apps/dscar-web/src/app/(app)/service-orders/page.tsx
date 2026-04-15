"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Search, FilterX, Plus } from "lucide-react"

import { useServiceOrders, useDebounce, usePersons } from "@/hooks"
import {
  Button,
  Input,
  TableSkeleton,
  EmptyState,
} from "@/components/ui"
import { ServiceOrderTable } from "./_components/ServiceOrderTable"
import { NewOSDrawer } from "./_components/NewOSDrawer"

const SELECT_CLS = "h-9 rounded-md border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"

export default function ServiceOrdersPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("ALL")
  const [customerType, setCustomerType] = useState<string>("ALL")
  const [insurerId, setInsurerId] = useState<string>("ALL")

  const debouncedSearch = useDebounce(search, 300)
  
  // Fetch seguradoras dynamically
  const { data: insurersData } = usePersons({ role: "INSURER" })

  // Omit empty/ALL filters
  const filters: Record<string, string> = {}
  if (debouncedSearch) filters.search = debouncedSearch
  if (status !== "ALL") filters.status = status
  if (customerType !== "ALL") filters.customer_type = customerType
  if (insurerId !== "ALL") filters.insurer = insurerId

  const { data, isLoading, isError } = useServiceOrders(filters)

  const clearFilters = () => {
    setSearch("")
    setStatus("ALL")
    setCustomerType("ALL")
    setInsurerId("ALL")
  }

  const hasFilters = search || status !== "ALL" || customerType !== "ALL" || insurerId !== "ALL"

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      <NewOSDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h1>
          <p className="text-sm text-neutral-500 mt-1">Gerencie a listagem tabular e aplique filtros para encontrar OS.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/service-orders/kanban"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-neutral-50"
          >
            Ver Kanban
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Nova OS
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-md border border-neutral-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            placeholder="Buscar OS (ex: placa, num, cliente)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <select
            className={SELECT_CLS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
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
          </select>

          <select
            className={SELECT_CLS}
            value={insurerId}
            onChange={(e) => setInsurerId(e.target.value)}
          >
            <option value="ALL">Qualquer Seguradora</option>
            {insurersData?.results.map((insurer) => (
              <option key={insurer.id} value={String(insurer.id)}>
                {insurer.fantasy_name || insurer.full_name}
              </option>
            ))}
          </select>

          <select
            className={SELECT_CLS}
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value)}
          >
            <option value="ALL">Qualquer Tipo</option>
            <option value="insurer">Seguradora</option>
            <option value="private">Particular</option>
          </select>

          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-neutral-500 hover:text-error-600 px-3">
              <FilterX className="h-4 w-4 mr-2" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
         {isLoading && <TableSkeleton columns={6} rows={8} />}

         {isError && (
           <EmptyState 
             title="Erro ao carregar Ordens de Serviço" 
             description="Tente recarregar a página." 
             className="bg-white border rounded-md" 
           />
         )}

         {!isLoading && !isError && data && (
           <>
             {data.results.length === 0 ? (
               <EmptyState 
                 title="Nenhuma Ordem de Serviço encontrada" 
                 description={hasFilters ? "Tente ajustar ou limpar seus filtros." : "O sistema ainda não possui ordens de serviço."}
                 className="bg-white border rounded-md"
               />
             ) : (
               <>
                 <ServiceOrderTable orders={data.results} />
                 
                 {/* Footer Info */}
                 {data.count > 0 && (
                   <div className="mt-4 flex items-center justify-between">
                     <p className="text-xs text-neutral-500">
                       Mostrando {Math.min(data.results.length, data.count)} de {data.count} registro{data.count !== 1 ? "s" : ""}
                     </p>
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
