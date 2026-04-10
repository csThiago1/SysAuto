"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Search, FilterX } from "lucide-react"

import { useServiceOrders, useDebounce, usePersons } from "@/hooks"
import { 
  Button, 
  Input, 
  TableSkeleton, 
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui"
import { ServiceOrderTable } from "./_components/ServiceOrderTable"

export default function ServiceOrdersPage() {
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
          <Link
            href="/service-orders/new"
            className="rounded-md bg-[#ea0e03] px-4 py-2 text-sm font-medium text-white hover:bg-red-700 shadow-sm"
          >
            Nova OS
          </Link>
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
           <Select value={status} onValueChange={setStatus}>
             <SelectTrigger className="w-[180px] bg-white">
               <SelectValue placeholder="Status" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="ALL">Todos os status</SelectItem>
               <SelectItem value="reception">Recepção</SelectItem>
               <SelectItem value="initial_survey">Vistoria Inicial</SelectItem>
               <SelectItem value="budget">Orçamento</SelectItem>
               <SelectItem value="waiting_auth">Aguardando Aprovação</SelectItem>
               <SelectItem value="authorized">Autorizada</SelectItem>
               <SelectItem value="waiting_parts">Aguardando Peças</SelectItem>
               <SelectItem value="repair">Reparo</SelectItem>
               <SelectItem value="mechanic">Mecânica</SelectItem>
               <SelectItem value="bodywork">Funilaria</SelectItem>
               <SelectItem value="painting">Pintura</SelectItem>
               <SelectItem value="assembly">Montagem</SelectItem>
               <SelectItem value="polishing">Polimento</SelectItem>
               <SelectItem value="washing">Lavagem</SelectItem>
               <SelectItem value="final_survey">Vistoria Final</SelectItem>
               <SelectItem value="ready">Pronta</SelectItem>
               <SelectItem value="delivered">Entregue</SelectItem>
               <SelectItem value="cancelled">Cancelada</SelectItem>
             </SelectContent>
           </Select>

           {/* Insurer Filter */}
           <Select value={insurerId} onValueChange={setInsurerId}>
             <SelectTrigger className="w-[160px] bg-white">
               <SelectValue placeholder="Seguradora" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="ALL">Qualquer Seguradora</SelectItem>
               {insurersData?.results.map((insurer) => (
                 <SelectItem key={insurer.id} value={String(insurer.id)}>
                   {insurer.fantasy_name || insurer.full_name}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>

           <Select value={customerType} onValueChange={setCustomerType}>
             <SelectTrigger className="w-[160px] bg-white">
               <SelectValue placeholder="Tipo de Cliente" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="ALL">Qualquer Tipo</SelectItem>
               <SelectItem value="insurer">Seguradora</SelectItem>
               <SelectItem value="private">Particular</SelectItem>
             </SelectContent>
           </Select>

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
