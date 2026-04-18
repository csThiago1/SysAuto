"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Plus, Search, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useServiceCatalog } from "@/hooks/useServiceCatalog"
import { ServiceFormSheet } from "./_components/ServiceFormSheet"
import { ServiceRow } from "./_components/ServiceRow"
import type { ServiceCatalogDetail } from "@paddock/types"
import {
  SERVICE_CATALOG_CATEGORY_LABELS,
  type ServiceCatalogCategory,
} from "@paddock/types"

const CATEGORY_EMOJI: Record<ServiceCatalogCategory, string> = {
  funilaria:   "🔧",
  pintura:     "🎨",
  mecanica:    "⚙️",
  eletrica:    "⚡",
  estetica:    "✨",
  alinhamento: "🔄",
  revisao:     "📋",
  lavagem:     "💧",
  outros:      "📦",
}

const ALL_CATS = Object.keys(SERVICE_CATALOG_CATEGORY_LABELS) as ServiceCatalogCategory[]

export default function ServicosPage() {
  const [search, setSearch]   = useState("")
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<ServiceCatalogDetail | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(ALL_CATS))

  const { data, isLoading } = useServiceCatalog(search ? { search } : undefined)
  const items = (data?.results ?? []) as ServiceCatalogDetail[]

  const grouped = useMemo(() => {
    const map = Object.fromEntries(ALL_CATS.map(c => [c, [] as ServiceCatalogDetail[]])) as Record<ServiceCatalogCategory, ServiceCatalogDetail[]>
    for (const item of items) {
      const cat = item.category as ServiceCatalogCategory
      ;(map[cat] ?? map.outros).push(item)
    }
    return map
  }, [items])

  function toggle(cat: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function handleNew() {
    setEditing(null)
    setOpen(true)
  }

  function handleEdit(item: ServiceCatalogDetail) {
    setEditing(item)
    setOpen(true)
  }

  const total = items.length

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Serviços</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            {total === 0 ? "Nenhum serviço cadastrado" : `${total} serviço${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button onClick={handleNew} className="bg-primary-600 hover:bg-primary-700 text-white gap-2">
          <Plus className="h-4 w-4" /> Novo Serviço
        </Button>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar serviço..."
          className="pl-9 h-9 bg-white"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-16 text-center text-sm text-neutral-400">Carregando…</div>
      )}

      {/* Vazio */}
      {!isLoading && total === 0 && (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
          <Tag className="h-10 w-10 text-neutral-200" />
          <p className="font-medium text-neutral-600">
            {search ? `Nenhum resultado para "${search}"` : "Ainda não há serviços cadastrados"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={handleNew}>
              Cadastrar primeiro serviço
            </Button>
          )}
        </div>
      )}

      {/* Lista por categoria */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col gap-2">
          {ALL_CATS.map(cat => {
            const catItems = grouped[cat]
            if (catItems.length === 0) return null

            const isOpen = expanded.has(cat)
            return (
              <div key={cat} className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                {/* Header da categoria */}
                <button
                  onClick={() => toggle(cat)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
                >
                  <span className="text-lg leading-none">{CATEGORY_EMOJI[cat]}</span>
                  <span className="flex-1 font-semibold text-sm text-neutral-800">
                    {SERVICE_CATALOG_CATEGORY_LABELS[cat]}
                  </span>
                  <Badge variant="secondary" className="text-xs tabular-nums font-normal">
                    {catItems.length}
                  </Badge>
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-neutral-400" />
                    : <ChevronRight className="h-4 w-4 text-neutral-400" />
                  }
                </button>

                {/* Linhas de serviço */}
                {isOpen && (
                  <div className="divide-y divide-neutral-100 border-t border-neutral-100">
                    {catItems.map(item => (
                      <ServiceRow key={item.id} item={item} onEdit={handleEdit} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ServiceFormSheet open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  )
}
