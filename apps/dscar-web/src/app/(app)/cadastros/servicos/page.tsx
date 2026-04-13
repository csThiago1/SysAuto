"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useServiceCatalog } from "@/hooks/useServiceCatalog"
import { ServiceCatalogTable } from "./_components/ServiceCatalogTable"
import { ServiceCatalogDialog } from "./_components/ServiceCatalogDialog"
import type { ServiceCatalogDetail } from "@paddock/types"
import { SERVICE_CATALOG_CATEGORY_LABELS } from "@paddock/types"

export default function ServicosPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceCatalogDetail | null>(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")

  const filters: Record<string, string> = {}
  if (search) filters.search = search
  if (category) filters.category = category

  const { data, isLoading } = useServiceCatalog(filters)

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(item: ServiceCatalogDetail) {
    setEditing(item)
    setDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Catálogo de Serviços</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Serviços padronizados com preço sugerido para agilizar o lançamento nas OS.
          </p>
        </div>
        <Button onClick={handleNew} className="bg-[#ea0e03] hover:bg-red-700 text-white gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Serviço
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            placeholder="Buscar serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white h-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todas as categorias</option>
          {Object.entries(SERVICE_CATALOG_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-neutral-400">Carregando...</div>
      ) : (
        <ServiceCatalogTable
          items={(data?.results ?? []) as ServiceCatalogDetail[]}
          onEdit={handleEdit}
        />
      )}

      <ServiceCatalogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
      />
    </div>
  )
}
