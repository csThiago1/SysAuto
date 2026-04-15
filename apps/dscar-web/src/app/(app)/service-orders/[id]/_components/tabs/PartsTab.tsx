"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2, Plus, Pencil, Trash2, Package } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useOSParts,
  useAddPart,
  useUpdatePart,
  useDeletePart,
} from "../../_hooks/useOSItems"
import type { ServiceOrderPart, CreatePartPayload } from "@paddock/types"

interface PartsTabProps {
  orderId?: string
}

type FormValues = {
  description: string
  part_number: string
  quantity: string
  unit_price: string
  discount: string
}

function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function PartsTab({ orderId }: PartsTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: parts, isLoading } = useOSParts(orderId)
  const addPart = useAddPart(orderId ?? "")
  const updatePart = useUpdatePart(orderId ?? "")
  const deletePart = useDeletePart(orderId ?? "")

  const { register, handleSubmit, reset, setValue } = useForm<FormValues>({
    defaultValues: { description: "", part_number: "", quantity: "1", unit_price: "", discount: "0" },
  })

  function startEdit(part: ServiceOrderPart) {
    setEditingId(part.id)
    setShowForm(true)
    setValue("description", part.description)
    setValue("part_number", part.part_number)
    setValue("quantity", part.quantity)
    setValue("unit_price", part.unit_price)
    setValue("discount", part.discount)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    reset()
  }

  async function onSubmit(values: FormValues) {
    if (!orderId) return
    const payload: CreatePartPayload = {
      description: values.description.trim(),
      part_number: values.part_number.trim(),
      quantity: parseFloat(values.quantity) || 1,
      unit_price: parseFloat(values.unit_price) || 0,
      discount: parseFloat(values.discount) || 0,
    }
    try {
      if (editingId) {
        await updatePart.mutateAsync({ id: editingId, data: payload })
      } else {
        await addPart.mutateAsync(payload)
      }
      cancelForm()
    } catch {
      toast.error("Erro ao salvar peça. Tente novamente.")
    }
  }

  async function handleDelete(partId: string) {
    if (!confirm("Remover esta peça?")) return
    await deletePart.mutateAsync(partId)
  }

  const isPending = addPart.isPending || updatePart.isPending

  // Totals
  const partsTotal = (parts ?? []).reduce((acc, p) => acc + p.total, 0)
  const discountTotal = (parts ?? []).reduce((acc, p) => acc + parseFloat(p.discount), 0)

  if (!orderId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
        <Package className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Salve a OS antes de adicionar peças.</p>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">Peças</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Peça
          </Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-medium text-neutral-700">
            {editingId ? "Editar Peça" : "Nova Peça"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Descrição *</Label>
              <Input {...register("description", { required: true })} placeholder="Ex: Para-choque dianteiro" />
            </div>
            <div>
              <Label className="text-xs">Código da Peça</Label>
              <Input {...register("part_number")} placeholder="Ex: PC-12345" />
            </div>
            <div>
              <Label className="text-xs">Quantidade *</Label>
              <Input {...register("quantity", { required: true })} type="number" min="0.01" step="0.01" />
            </div>
            <div>
              <Label className="text-xs">Preço Unitário (R$) *</Label>
              <Input {...register("unit_price", { required: true })} type="number" min="0" step="0.01" placeholder="0,00" />
            </div>
            <div>
              <Label className="text-xs">Desconto (R$)</Label>
              <Input {...register("discount")} type="number" min="0" step="0.01" placeholder="0,00" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={cancelForm}>Cancelar</Button>
            <Button type="button" size="sm" disabled={isPending} onClick={() => handleSubmit(onSubmit)()}>
              {isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-neutral-400 h-5 w-5" /></div>
      ) : !parts || parts.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-8 text-center text-neutral-400 text-sm">
          Nenhuma peça adicionada.
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-neutral-600">Descrição</th>
                <th className="text-left px-4 py-2.5 font-medium text-neutral-600 hidden sm:table-cell">Código</th>
                <th className="text-right px-4 py-2.5 font-medium text-neutral-600">Qtd</th>
                <th className="text-right px-4 py-2.5 font-medium text-neutral-600">Unit.</th>
                <th className="text-right px-4 py-2.5 font-medium text-neutral-600 hidden md:table-cell">Desconto</th>
                <th className="text-right px-4 py-2.5 font-medium text-neutral-600">Total</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {parts.map((part) => (
                <tr key={part.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-neutral-900 font-medium">{part.description}</td>
                  <td className="px-4 py-3 text-neutral-500 hidden sm:table-cell">{part.part_number || "—"}</td>
                  <td className="px-4 py-3 text-right text-neutral-700">{part.quantity}</td>
                  <td className="px-4 py-3 text-right text-neutral-700">{formatCurrency(part.unit_price)}</td>
                  <td className="px-4 py-3 text-right text-neutral-500 hidden md:table-cell">
                    {parseFloat(part.discount) > 0 ? formatCurrency(part.discount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900">{formatCurrency(part.total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(part)}
                        className="p-1.5 rounded text-neutral-400 hover:text-primary hover:bg-neutral-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(part.id)}
                        className="p-1.5 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-neutral-50 border-t border-neutral-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-sm text-neutral-500 hidden md:table-cell">
                  {discountTotal > 0 && `Descontos: ${formatCurrency(discountTotal)}`}
                </td>
                <td colSpan={2} className="px-4 py-3 text-right text-sm font-bold text-neutral-900 md:hidden">
                  Total Peças:
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-neutral-900">
                  {formatCurrency(partsTotal)}
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
