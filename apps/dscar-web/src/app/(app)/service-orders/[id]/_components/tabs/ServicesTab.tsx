"use client"

import { useState, useMemo } from "react"
import { Plus, Trash2, Search, Pencil, Check, X, ChevronDown, ChevronRight } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useOSLaborItems,
  useOSLaborCreate,
  useOSLaborDelete,
  useOSLaborUpdate,
  useServiceCatalog,
} from "@/hooks/useServiceCatalog"
import type { ServiceOrderStatus } from "@paddock/types"
import { formatCurrency } from "@paddock/utils"

const BLOCKED_STATUSES: ServiceOrderStatus[] = ["ready", "delivered", "cancelled"]

const addSchema = z.object({
  description:     z.string().min(2, "Descrição obrigatória"),
  quantity:        z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido").default("1"),
  unit_price:      z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido"),
  discount:        z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido").default("0"),
  service_catalog: z.string().nullable().optional(),
})
type AddForm = z.infer<typeof addSchema>

const LABEL = "block text-xs font-bold uppercase tracking-wide text-white/40 mb-0.5"
const INPUT  = "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"

interface Props {
  osId: string
  osStatus: ServiceOrderStatus
}

export function ServicesTab({ osId, osStatus }: Props) {
  const isBlocked = BLOCKED_STATUSES.includes(osStatus)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [showCatalog, setShowCatalog] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<string>("all")

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState("")
  const [editPrice, setEditPrice] = useState("")

  const { data: laborData, isLoading } = useOSLaborItems(osId)
  const { data: catalogData } = useServiceCatalog(catalogSearch ? { search: catalogSearch } : undefined)
  const addMutation    = useOSLaborCreate(osId)
  const deleteMutation = useOSLaborDelete(osId)
  const updateMutation = useOSLaborUpdate(osId)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<AddForm>({ resolver: zodResolver(addSchema), defaultValues: { quantity: "1", discount: "0" } })

  function selectFromCatalog(item: { id: string; name: string; suggested_price: string }) {
    setValue("description", item.name)
    setValue("unit_price", item.suggested_price)
    setValue("service_catalog", item.id)
    setShowCatalog(false)
    setCatalogSearch("")
  }

  function handleDiscountToggle(checked: boolean) {
    setShowDiscount(checked)
    if (!checked) setValue("discount", "0")
  }

  async function onAdd(data: AddForm) {
    try {
      await addMutation.mutateAsync({
        description:     data.description,
        quantity:        data.quantity,
        unit_price:      data.unit_price,
        discount:        data.discount || "0",
        service_catalog: data.service_catalog ?? null,
      })
      reset({ quantity: "1", discount: "0", description: "", unit_price: "", service_catalog: null })
      setShowDiscount(false)
      toast.success("Serviço adicionado.")
    } catch {
      toast.error("Erro ao adicionar serviço.")
    }
  }

  async function handleDelete(laborId: string, desc: string) {
    if (!confirm(`Remover "${desc}"?`)) return
    try {
      await deleteMutation.mutateAsync(laborId)
      toast.success("Serviço removido.")
    } catch {
      toast.error("Erro ao remover serviço.")
    }
  }

  function startEdit(item: { id: string; quantity: string; unit_price: string }) {
    setEditingId(item.id)
    setEditQty(item.quantity)
    setEditPrice(item.unit_price)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(laborId: string) {
    const qty = parseFloat(editQty)
    const price = parseFloat(editPrice)
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
      toast.error("Valores inválidos.")
      return
    }
    try {
      await updateMutation.mutateAsync({
        laborId,
        payload: { quantity: String(qty), unit_price: String(price) },
      })
      setEditingId(null)
      toast.success("Serviço atualizado.")
    } catch {
      toast.error("Erro ao atualizar serviço.")
    }
  }

  const items           = laborData ?? []
  const filteredItems   = sourceFilter === "all" ? items : items.filter((i) => i.source_type === sourceFilter)
  const servicesSubtotal = items.reduce((sum, i) => sum + Number(i.unit_price) * Number(i.quantity), 0)
  const servicesDiscount = items.reduce((sum, i) => sum + Number(i.discount), 0)
  const servicesTotal    = items.reduce((sum, i) => sum + i.total, 0)

  return (
    <div className="space-y-4 py-6">
      {!isBlocked && (
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Adicionar Serviço
          </p>

          {/* Busca no catálogo */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
                <input
                  className={`${INPUT} pl-8`}
                  placeholder="Buscar no catálogo..."
                  value={catalogSearch}
                  onChange={(e) => { setCatalogSearch(e.target.value); setShowCatalog(true) }}
                  onFocus={() => setShowCatalog(true)}
                />
              </div>
            </div>
            {showCatalog && catalogData && catalogData.results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-white/10 bg-white/5 shadow-lg max-h-48 overflow-y-auto">
                {catalogData.results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.03] flex justify-between items-center"
                    onMouseDown={() => selectFromCatalog(item)}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-white/40">
                      {Number(item.suggested_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className={LABEL}>Descrição *</label>
              <input
                className={errors.description ? `${INPUT} border-red-400` : INPUT}
                placeholder="Descrição do serviço"
                {...register("description")}
              />
              {errors.description && (
                <p className="mt-0.5 text-xs text-error-400">{errors.description.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>Qtd.</label>
                <input className={INPUT} type="number" step="0.01" min="0.01" {...register("quantity")} />
              </div>
              <div>
                <label className={LABEL}>Valor Unit. (R$) *</label>
                <input
                  className={errors.unit_price ? `${INPUT} border-red-400` : INPUT}
                  placeholder="0.00"
                  {...register("unit_price")}
                />
                {errors.unit_price && (
                  <p className="mt-0.5 text-xs text-error-400">{errors.unit_price.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="services-show-discount"
                  checked={showDiscount}
                  onChange={(e) => handleDiscountToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-white/15 text-primary-600 cursor-pointer"
                />
                <label htmlFor="services-show-discount" className="text-xs font-medium text-white/40 uppercase tracking-wide cursor-pointer">
                  Aplicar desconto
                </label>
              </div>
              {showDiscount && (
                <div>
                  <label className={LABEL}>Desconto (R$)</label>
                  <input className={INPUT} placeholder="0.00" {...register("discount")} />
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => handleSubmit(onAdd)()}
                disabled={isSubmitting}
                size="sm"
                className="bg-primary-600 hover:bg-primary-700 text-white gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all", label: "Todos", count: items.length, color: "" },
            { id: "import", label: "Seguradora", count: items.filter((i) => i.source_type === "import").length, color: "info" },
            { id: "complement", label: "Particular", count: items.filter((i) => i.source_type === "complement").length, color: "warning" },
            { id: "manual", label: "Manual", count: items.filter((i) => i.source_type === "manual").length, color: "" },
          ]
            .filter((f) => f.id === "all" || f.count > 0)
            .map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSourceFilter(f.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  sourceFilter === f.id
                    ? f.color === "info"
                      ? "bg-info-500/15 text-info-500"
                      : f.color === "warning"
                      ? "bg-warning-500/15 text-warning-500"
                      : "bg-white/15 text-white"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                )}
              >
                {f.label} ({f.count})
              </button>
            ))}
        </div>
      )}

      {/* Tabela de serviços */}
      {isLoading ? (
        <p className="text-sm text-white/40">Carregando serviços...</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/40">Nenhum serviço adicionado.</p>
      ) : (
        <>
          <ServiceGroupedView
            items={filteredItems}
            isBlocked={isBlocked}
            editingId={editingId}
            editQty={editQty}
            editPrice={editPrice}
            setEditQty={setEditQty}
            setEditPrice={setEditPrice}
            startEdit={startEdit}
            saveEdit={saveEdit}
            cancelEdit={cancelEdit}
            handleDelete={handleDelete}
          />

          {/* Totals panel */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Subtotal</span>
              <span className="font-medium">{formatCurrency(servicesSubtotal)}</span>
            </div>
            {servicesDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Desconto</span>
                <span className="font-medium text-error-400">- {formatCurrency(servicesDiscount)}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-white/90">Total Serviços</span>
              <span className="text-base font-bold text-white">{formatCurrency(servicesTotal)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Parse "[Tipo] Descrição" → { svcType, partName } */
function parseServiceDescription(desc: string): { svcType: string; partName: string } {
  const match = desc.match(/^\[(.+?)\]\s*(.+)$/)
  return match ? { svcType: match[1], partName: match[2] } : { svcType: "", partName: desc }
}

interface GroupedItem {
  partName: string
  items: any[]
  total: number
}

/** Agrupa itens importados por nome de peça, mantém manuais/complemento como flat */
function groupServicesByPart(items: any[]): { groups: GroupedItem[]; flatItems: any[] } {
  const groups = new Map<string, any[]>()
  const flatItems: any[] = []

  for (const item of items) {
    const { svcType, partName } = parseServiceDescription(item.description)
    // Itens importados com tipo de serviço → agrupar
    if (svcType && item.source_type === "import") {
      const existing = groups.get(partName) || []
      existing.push({ ...item, _svcType: svcType, _partName: partName })
      groups.set(partName, existing)
    } else {
      flatItems.push(item)
    }
  }

  const result: GroupedItem[] = []
  for (const [partName, groupItems] of groups) {
    // Se só tem 1 item, não precisa accordion
    if (groupItems.length === 1) {
      flatItems.push(groupItems[0])
    } else {
      const total = groupItems.reduce((sum: number, i: any) => sum + Number(i.total || 0), 0)
      result.push({ partName, items: groupItems, total })
    }
  }

  return { groups: result, flatItems }
}

// ── Accordion View ──────────────────────────────────────────────────

interface ServiceGroupedViewProps {
  items: any[]
  isBlocked: boolean
  editingId: string | null
  editQty: string
  editPrice: string
  setEditQty: (v: string) => void
  setEditPrice: (v: string) => void
  startEdit: (item: any) => void
  saveEdit: (id: string) => Promise<void>
  cancelEdit: () => void
  handleDelete: (id: string, desc: string) => void
}

function ServiceGroupedView({
  items, isBlocked, editingId, editQty, editPrice,
  setEditQty, setEditPrice, startEdit, saveEdit, cancelEdit, handleDelete,
}: ServiceGroupedViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const { groups, flatItems } = useMemo(() => groupServicesByPart(items), [items])

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {/* Accordion groups */}
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.partName)
        return (
          <div key={group.partName} className="rounded-lg border border-white/10 overflow-hidden">
            {/* Group header */}
            <button
              type="button"
              onClick={() => toggleGroup(group.partName)}
              className="flex w-full items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-info-500" />
                  : <ChevronRight className="h-4 w-4 text-white/40" />
                }
                <span className="text-sm font-semibold text-white">{group.partName}</span>
                <span className="text-[11px] text-white/40 bg-white/5 px-2 py-0.5 rounded">
                  {group.items.length} operações
                </span>
              </div>
              <span className="text-sm font-bold font-mono text-white">
                {formatCurrency(group.total)}
              </span>
            </button>

            {/* Expanded sub-rows */}
            {isExpanded && (
              <table className="w-full text-sm">
                <tbody>
                  {group.items.map((item: any) => (
                    <ServiceSubRow
                      key={item.id}
                      item={item}
                      isBlocked={isBlocked}
                      editingId={editingId}
                      editQty={editQty}
                      editPrice={editPrice}
                      setEditQty={setEditQty}
                      setEditPrice={setEditPrice}
                      startEdit={startEdit}
                      saveEdit={saveEdit}
                      cancelEdit={cancelEdit}
                      handleDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {/* Flat items (manual, complement, single-operation) */}
      {flatItems.length > 0 && (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {flatItems.map((item: any) => {
                const { svcType, partName } = parseServiceDescription(item.description)
                const isEditing = editingId === item.id
                return (
                  <tr key={item.id} className="border-t border-white/5 first:border-t-0">
                    <td className="py-2.5 px-4 text-white/90 font-medium">{partName}</td>
                    <td className="py-2.5 px-3 text-xs text-white/50">{svcType || "Serviço"}</td>
                    <td className="py-2.5 px-3 text-right text-white/60 font-mono">{item.quantity}h</td>
                    <td className="py-2.5 px-3 text-right text-white/40 font-mono">{formatCurrency(item.unit_price)}/h</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-white/90">{formatCurrency(item.total)}</td>
                    {!isBlocked && (
                      <td className="py-2.5 px-3 text-center w-16">
                        <div className="flex items-center gap-1 justify-center">
                          <button type="button" onClick={() => startEdit(item)}
                            className="text-white/30 hover:text-white/60 transition-colors" title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDelete(item.id, item.description)}
                            className="text-white/30 hover:text-error-400 transition-colors" title="Remover">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Sub-row inside an accordion group */
function ServiceSubRow({
  item, isBlocked, editingId, editQty, editPrice,
  setEditQty, setEditPrice, startEdit, saveEdit, cancelEdit, handleDelete,
}: {
  item: any
  isBlocked: boolean
  editingId: string | null
  editQty: string
  editPrice: string
  setEditQty: (v: string) => void
  setEditPrice: (v: string) => void
  startEdit: (item: any) => void
  saveEdit: (id: string) => Promise<void>
  cancelEdit: () => void
  handleDelete: (id: string, desc: string) => void
}) {
  const isEditing = editingId === item.id
  return (
    <tr className="border-t border-white/5">
      <td className="py-2 pl-10 pr-3 text-white/60">{item._svcType}</td>
      <td className="py-2 px-3 text-right text-white/90 font-mono">
        {isEditing ? (
          <input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)}
            className="w-16 border border-white/15 rounded px-1 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
            min="0.01" step="0.01" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(item.id); if (e.key === "Escape") cancelEdit() }}
          />
        ) : (
          <span className={!isBlocked ? "cursor-pointer hover:text-primary-600" : ""} onClick={!isBlocked ? () => startEdit(item) : undefined}>
            {item.quantity}h
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right text-white/40 font-mono">
        {isEditing ? (
          <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
            className="w-20 border border-white/15 rounded px-1 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
            min="0" step="0.01"
            onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(item.id); if (e.key === "Escape") cancelEdit() }}
          />
        ) : (
          <span className={!isBlocked ? "cursor-pointer hover:text-primary-600" : ""} onClick={!isBlocked ? () => startEdit(item) : undefined}>
            {formatCurrency(item.unit_price)}/h
          </span>
        )}
      </td>
      <td className="py-2 px-4 text-right font-mono font-semibold text-white/90">{formatCurrency(item.total)}</td>
      {!isBlocked && (
        <td className="py-2 px-3 text-center w-16">
          {isEditing ? (
            <div className="flex items-center gap-1 justify-center">
              <button type="button" onClick={() => void saveEdit(item.id)} className="text-success-400 hover:text-success-300" title="Salvar">
                <Check className="h-4 w-4" />
              </button>
              <button type="button" onClick={cancelEdit} className="text-white/40 hover:text-white/60" title="Cancelar">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 justify-center">
              <button type="button" onClick={() => startEdit(item)} className="text-white/30 hover:text-white/60" title="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => handleDelete(item.id, item.description)} className="text-white/30 hover:text-error-400" title="Remover">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  )
}
