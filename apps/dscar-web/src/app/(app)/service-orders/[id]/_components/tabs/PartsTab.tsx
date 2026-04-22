"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2, Plus, Pencil, Trash2, Package } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useOSParts,
  useAddPart,
  useUpdatePart,
  useDeletePart,
} from "../../_hooks/useOSItems"
import type { ServiceOrderPart, CreatePartPayload } from "@paddock/types"
import { formatCurrency } from "@paddock/utils"

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

export function PartsTab({ orderId }: PartsTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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
    setShowDiscount(parseFloat(part.discount) > 0)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setShowDiscount(false)
    reset()
  }

  function handleDiscountToggle(checked: boolean) {
    setShowDiscount(checked)
    if (!checked) setValue("discount", "0")
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
    try {
      await deletePart.mutateAsync(partId)
      toast.success("Peça removida.")
    } catch {
      toast.error("Erro ao remover peça.")
    }
  }

  const isPending = addPart.isPending || updatePart.isPending

  // Totals
  const partsTotal = (parts ?? []).reduce((acc, p) => acc + p.total, 0)
  const discountTotal = (parts ?? []).reduce((acc, p) => acc + parseFloat(p.discount), 0)

  if (!orderId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/40">
        <Package className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Salve a OS antes de adicionar peças.</p>
      </div>
    )
  }

  return (
    <div className="py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Peças</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Peça
          </Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-medium text-white/70">
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
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="parts-show-discount"
                  checked={showDiscount}
                  onChange={(e) => handleDiscountToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-white/15 text-primary-600 cursor-pointer"
                />
                <label htmlFor="parts-show-discount" className="text-xs font-medium text-white/70 cursor-pointer">
                  Aplicar desconto
                </label>
              </div>
              {showDiscount && (
                <>
                  <Label className="text-xs">Desconto (R$)</Label>
                  <Input {...register("discount")} type="number" min="0" step="0.01" placeholder="0,00" />
                </>
              )}
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
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-white/40 h-5 w-5" /></div>
      ) : !parts || parts.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center text-white/40 text-sm">
          Nenhuma peça adicionada.
        </div>
      ) : (
        <>
          <div className="rounded-md border border-white/10 overflow-hidden">
            <Table>
              <TableHeader className="bg-white/[0.03]">
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden sm:table-cell">Código</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Unit.</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Desconto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell className="text-white font-medium">{part.description}</TableCell>
                    <TableCell className="text-white/50 hidden sm:table-cell">{part.part_number || "—"}</TableCell>
                    <TableCell className="text-right text-white/70">{part.quantity}</TableCell>
                    <TableCell className="text-right text-white/70">{formatCurrency(part.unit_price)}</TableCell>
                    <TableCell className="text-right text-white/50 hidden md:table-cell">
                      {parseFloat(part.discount) > 0 ? formatCurrency(part.discount) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-white">{formatCurrency(part.total)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(part)}
                          className="p-1.5 rounded text-white/40 hover:text-primary hover:bg-white/5"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(part.id)}
                          className="p-1.5 rounded text-white/40 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals panel */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Subtotal</span>
              <span className="font-medium">{formatCurrency((parts ?? []).reduce((acc, p) => acc + parseFloat(p.unit_price) * parseFloat(p.quantity), 0))}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Desconto</span>
                <span className="font-medium text-red-600">- {formatCurrency(discountTotal)}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-white/90">Total Peças</span>
              <span className="text-base font-bold text-white">{formatCurrency(partsTotal)}</span>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}
        title="Remover peça"
        description="Tem certeza que deseja remover esta peça da OS?"
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
      />
    </div>
  )
}
