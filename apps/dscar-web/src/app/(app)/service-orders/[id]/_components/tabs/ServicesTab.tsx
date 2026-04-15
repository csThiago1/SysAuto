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

const LABEL = "block text-xs font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
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

  const items           = laborData ?? []
  const servicesSubtotal = items.reduce((sum, i) => sum + Number(i.unit_price) * Number(i.quantity), 0)
  const servicesDiscount = items.reduce((sum, i) => sum + Number(i.discount), 0)
  const servicesTotal    = items.reduce((sum, i) => sum + i.total, 0)

  return (
    <div className="space-y-4 py-6">
      {!isBlocked && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
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

          <div className="space-y-2">
            <div>
              <label className={LABEL}>Descrição *</label>
              <input
                className={errors.description ? `${INPUT} border-red-400` : INPUT}
                placeholder="Descrição do serviço"
                {...register("description")}
              />
              {errors.description && (
                <p className="mt-0.5 text-xs text-red-600">{errors.description.message}</p>
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
                  <p className="mt-0.5 text-xs text-red-600">{errors.unit_price.message}</p>
                )}
              </div>
              <div>
                <label className={LABEL}>Desconto (R$)</label>
                <input className={INPUT} placeholder="0.00" {...register("discount")} />
              </div>
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

      {/* Tabela de serviços */}
      {isLoading ? (
        <p className="text-sm text-neutral-400">Carregando serviços...</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">Nenhum serviço adicionado.</p>
      ) : (
        <>
          <div className="rounded-md border border-neutral-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-neutral-50">
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Unit.</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {!isBlocked && <TableHead className="w-8" />}
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white">
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="py-2.5 px-3">
                      <span className="font-medium text-neutral-800">{item.description}</span>
                      {item.service_catalog_name && item.service_catalog_name !== item.description && (
                        <span className="ml-1 text-xs text-neutral-400">
                          ({item.service_catalog_name})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right text-neutral-600">{item.quantity}</TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-mono text-neutral-600">
                      {formatCurrency(item.unit_price)}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-mono text-neutral-400">
                      {Number(item.discount) > 0
                        ? `- ${formatCurrency(item.discount)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-800">
                      {formatCurrency(item.total)}
                    </TableCell>
                    {!isBlocked && (
                      <TableCell className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.description)}
                          className="text-neutral-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals panel */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(servicesSubtotal)}</span>
            </div>
            {servicesDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Desconto</span>
                <span className="font-medium text-red-600">- {formatCurrency(servicesDiscount)}</span>
              </div>
            )}
            <div className="border-t border-neutral-200 pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">Total Serviços</span>
              <span className="text-base font-bold text-neutral-900">{formatCurrency(servicesTotal)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
