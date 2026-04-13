"use client"

import { useState } from "react"
import { Plus, Trash2, Search } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useOSLaborItems,
  useOSLaborCreate,
  useOSLaborDelete,
  useServiceCatalog,
} from "@/hooks/useServiceCatalog"
import type { ServiceOrderStatus } from "@paddock/types"

const BLOCKED_STATUSES: ServiceOrderStatus[] = ["ready", "delivered", "cancelled"]

const addSchema = z.object({
  description:     z.string().min(2, "Descrição obrigatória"),
  quantity:        z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido").default("1"),
  unit_price:      z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido"),
  discount:        z.string().regex(/^\d+(\.\d{1,2})?$/, "Inválido").default("0"),
  service_catalog: z.string().nullable().optional(),
})
type AddForm = z.infer<typeof addSchema>

const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT  = "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"

interface Props {
  osId: string
  osStatus: ServiceOrderStatus
}

export function ServicesTab({ osId, osStatus }: Props) {
  const isBlocked = BLOCKED_STATUSES.includes(osStatus)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [showCatalog, setShowCatalog] = useState(false)

  const { data: laborData, isLoading } = useOSLaborItems(osId)
  const { data: catalogData } = useServiceCatalog(catalogSearch ? { search: catalogSearch } : undefined)
  const addMutation    = useOSLaborCreate(osId)
  const deleteMutation = useOSLaborDelete(osId)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<AddForm>({ resolver: zodResolver(addSchema), defaultValues: { quantity: "1", discount: "0" } })

  function selectFromCatalog(item: { id: string; name: string; suggested_price: string }) {
    setValue("description", item.name)
    setValue("unit_price", item.suggested_price)
    setValue("service_catalog", item.id)
    setShowCatalog(false)
    setCatalogSearch("")
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

  const items          = laborData ?? []
  const servicesTotal  = items.reduce((sum, i) => sum + i.total, 0)

  return (
    <div className="space-y-4 py-6">
      {!isBlocked && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Adicionar Serviço
          </p>

          {/* Busca no catálogo */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
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
              <div className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                {catalogData.results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex justify-between items-center"
                    onMouseDown={() => selectFromCatalog(item)}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-neutral-400">
                      {Number(item.suggested_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit(onAdd)} className="space-y-2">
            <div>
              <label className={LABEL}>Descrição *</label>
              <input
                className={errors.description ? `${INPUT} border-red-400` : INPUT}
                placeholder="Descrição do serviço"
                {...register("description")}
              />
              {errors.description && (
                <p className="mt-0.5 text-[10px] text-red-600">{errors.description.message}</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
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
                  <p className="mt-0.5 text-[10px] text-red-600">{errors.unit_price.message}</p>
                )}
              </div>
              <div>
                <label className={LABEL}>Desconto (R$)</label>
                <input className={INPUT} placeholder="0.00" {...register("discount")} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-[#ea0e03] hover:bg-red-700 text-white gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de serviços */}
      {isLoading ? (
        <p className="text-sm text-neutral-400">Carregando serviços...</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">Nenhum serviço adicionado.</p>
      ) : (
        <div className="rounded-md border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-[11px] font-semibold uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-right">Qtd.</th>
                <th className="px-3 py-2 text-right">Unit.</th>
                <th className="px-3 py-2 text-right">Desconto</th>
                <th className="px-3 py-2 text-right">Total</th>
                {!isBlocked && <th className="px-3 py-2 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-neutral-800">{item.description}</span>
                    {item.service_catalog_name && item.service_catalog_name !== item.description && (
                      <span className="ml-1 text-[10px] text-neutral-400">
                        ({item.service_catalog_name})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-neutral-600">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-600">
                    {Number(item.unit_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-neutral-400">
                    {Number(item.discount) > 0
                      ? `- ${Number(item.discount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-neutral-800">
                    {item.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  {!isBlocked && (
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.description)}
                        className="text-neutral-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-neutral-50 border-t border-neutral-200">
                <td
                  colSpan={isBlocked ? 4 : 5}
                  className="px-3 py-2 text-right text-xs font-semibold uppercase text-neutral-500"
                >
                  Total Serviços
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold text-neutral-800">
                  {servicesTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
