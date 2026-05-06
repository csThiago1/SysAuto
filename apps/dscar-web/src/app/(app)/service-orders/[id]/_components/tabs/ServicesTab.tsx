"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  useOSLaborItems,
  useOSLaborCreate,
  useOSLaborDelete,
  useOSLaborUpdate,
  useServiceCatalog,
} from "@/hooks/useServiceCatalog"
import type { ServiceOrderStatus } from "@paddock/types"
import { formatCurrency } from "@paddock/utils"
import { ServiceGroupedView } from "./ServicesTab"
import type { ServiceItem } from "../../_utils/service-grouping"

const BLOCKED_STATUSES: ServiceOrderStatus[] = ["ready", "delivered", "cancelled"]

const addSchema = z.object({
  description:     z.string().min(2, "Descrição obrigatória"),
  quantity:        z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido").default("1"),
  unit_price:      z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido"),
  discount:        z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido").default("0"),
  service_catalog: z.string().nullable().optional(),
})
type AddForm = z.infer<typeof addSchema>

const LABEL = "block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-0.5"
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

  function startEdit(item: ServiceItem) {
    setEditingId(item.id)
    setEditQty(String(item.quantity))
    setEditPrice(String(item.unit_price))
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

  const items            = laborData ?? []
  const filteredItems    = sourceFilter === "all" ? items : items.filter((i) => i.source_type === sourceFilter)
  const servicesSubtotal = items.reduce((sum, i) => sum + Number(i.unit_price) * Number(i.quantity), 0)
  const servicesDiscount = items.reduce((sum, i) => sum + Number(i.discount), 0)
  const servicesTotal    = items.reduce((sum, i) => sum + i.total, 0)

  return (
    <div className="space-y-4 py-6">
      {!isBlocked && (
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Adicionar Serviço
          </p>

          {/* Busca no catálogo */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
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
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(Number(item.suggested_price))}
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
                <label htmlFor="services-show-discount" className="text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer">
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
            { id: "all",        label: "Todos",       count: items.length,                                                    color: "" },
            { id: "import",     label: "Seguradora",  count: items.filter((i) => i.source_type === "import").length,     color: "info" },
            { id: "complement", label: "Particular",  count: items.filter((i) => i.source_type === "complement").length, color: "warning" },
            { id: "manual",     label: "Manual",      count: items.filter((i) => i.source_type === "manual").length,     color: "" },
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
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                )}
              >
                {f.label} ({f.count})
              </button>
            ))}
        </div>
      )}

      {/* Tabela de serviços */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando serviços...</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum serviço adicionado.</p>
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
              <span className="text-foreground/60">Subtotal</span>
              <span className="font-medium">{formatCurrency(servicesSubtotal)}</span>
            </div>
            {servicesDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/60">Desconto</span>
                <span className="font-medium text-error-400">- {formatCurrency(servicesDiscount)}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground/90">Total Serviços</span>
              <span className="text-base font-bold text-white">{formatCurrency(servicesTotal)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
