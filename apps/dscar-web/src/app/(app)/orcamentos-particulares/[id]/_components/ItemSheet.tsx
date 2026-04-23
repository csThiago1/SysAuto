"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useCreateBudgetItem } from "@/hooks/useBudgets"
import type { BudgetItemCreatePayload, BudgetVersionItem } from "@paddock/types"

interface OperationRow {
  operation_type_code: string
  labor_category_code: string
  hours: string
  hourly_rate: string
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  budgetId: number
  versionId: number
  item: BudgetVersionItem | null
}

const OPERATION_TYPE_OPTIONS = [
  { code: "TROCA",               label: "Troca" },
  { code: "RECUPERACAO",         label: "Recuperação" },
  { code: "OVERLAP",             label: "Overlap" },
  { code: "PINTURA",             label: "Pintura" },
  { code: "R_I",                 label: "Remoção e Instalação" },
  { code: "MONTAGEM_DESMONTAGEM", label: "Montagem/Desmontagem" },
  { code: "DNC",                 label: "DNC" },
]

const LABOR_CATEGORY_OPTIONS = [
  { code: "FUNILARIA",  label: "Funilaria" },
  { code: "PINTURA",    label: "Pintura" },
  { code: "MECANICA",   label: "Mecânica" },
  { code: "ELETRICA",   label: "Elétrica" },
  { code: "TAPECARIA",  label: "Tapeçaria" },
  { code: "ACABAMENTO", label: "Acabamento" },
  { code: "VIDRACARIA", label: "Vidraçaria" },
  { code: "REPARACAO",  label: "Reparação" },
  { code: "SERVICOS",   label: "Serviços" },
]

export function ItemSheet({ open, onOpenChange, budgetId, versionId, item }: Props) {
  const { mutateAsync: createItem, isPending } = useCreateBudgetItem(budgetId, versionId)

  const [description, setDescription] = useState("")
  const [itemType,    setItemType]     = useState<string>("PART")
  const [quantity,    setQuantity]     = useState("1.000")
  const [unitPrice,   setUnitPrice]    = useState("0.00")
  const [discountPct, setDiscountPct]  = useState("0.00")
  const [operations,  setOperations]   = useState<OperationRow[]>([])

  useEffect(() => {
    if (item) {
      setDescription(item.description)
      setItemType(item.item_type)
      setQuantity(item.quantity)
      setUnitPrice(item.unit_price)
      setDiscountPct(item.discount_pct)
      setOperations(
        item.operations.map((op) => ({
          operation_type_code: op.operation_type.code,
          labor_category_code: op.labor_category.code,
          hours:               op.hours,
          hourly_rate:         op.hourly_rate,
        }))
      )
    } else {
      setDescription("")
      setItemType("PART")
      setQuantity("1.000")
      setUnitPrice("0.00")
      setDiscountPct("0.00")
      setOperations([])
    }
  }, [item, open])

  const netPrice = (() => {
    const gross    = parseFloat(unitPrice || "0") * parseFloat(quantity || "0")
    const discount = gross * (parseFloat(discountPct || "0") / 100)
    return Math.max(0, gross - discount).toFixed(2)
  })()

  function addOperation() {
    setOperations((prev) => [
      ...prev,
      { operation_type_code: "TROCA", labor_category_code: "FUNILARIA", hours: "1.00", hourly_rate: "80.00" },
    ])
  }

  function updateOp(idx: number, field: keyof OperationRow, value: string) {
    setOperations((prev) => prev.map((op, i) => (i === idx ? { ...op, [field]: value } : op)))
  }

  function removeOp(idx: number) {
    setOperations((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!description.trim()) {
      toast.error("Informe a descrição do item.")
      return
    }
    const payload: BudgetItemCreatePayload = {
      description:  description.trim(),
      item_type:    itemType as BudgetItemCreatePayload["item_type"],
      quantity,
      unit_price:   unitPrice,
      net_price:    netPrice,
      discount_pct: discountPct,
      operations:   operations.map((op) => ({
        operation_type_code: op.operation_type_code,
        labor_category_code: op.labor_category_code,
        hours:               op.hours,
        hourly_rate:         op.hourly_rate,
        labor_cost:          (parseFloat(op.hours) * parseFloat(op.hourly_rate)).toFixed(2),
      })),
    }
    try {
      await createItem(payload)
      toast.success("Item salvo.")
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar item.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] bg-[#1c1c1e] border-white/10 text-white overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-white">
            {item ? "Editar Item" : "Novo Item"}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Parabrisa dianteiro"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Tipo</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PART">Peça</SelectItem>
                <SelectItem value="SERVICE">Serviço</SelectItem>
                <SelectItem value="EXTERNAL_SERVICE">Serviço Externo</SelectItem>
                <SelectItem value="FEE">Taxa</SelectItem>
                <SelectItem value="DISCOUNT">Desconto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade + Preço + Desconto */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Qtd</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Preço Unit. (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Desconto (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>

          {/* Total calculado */}
          <div className="rounded-lg bg-white/5 px-3 py-2 flex justify-between text-sm">
            <span className="text-white/50">Total Líquido</span>
            <span className="text-white font-medium">
              {parseFloat(netPrice).toLocaleString("pt-BR", {
                style: "currency", currency: "BRL",
              })}
            </span>
          </div>

          {/* Operações MO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-white/70 text-xs">Operações de Mão de Obra</Label>
              <button
                type="button"
                onClick={addOperation}
                className="text-xs text-info-400 hover:text-info-300 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Adicionar
              </button>
            </div>

            {operations.length === 0 && (
              <p className="text-xs text-white/30 py-2">Nenhuma operação de MO.</p>
            )}

            {operations.map((op, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">Tipo de Operação</Label>
                    <Select
                      value={op.operation_type_code}
                      onValueChange={(v) => updateOp(idx, "operation_type_code", v)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATION_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">Categoria</Label>
                    <Select
                      value={op.labor_category_code}
                      onValueChange={(v) => updateOp(idx, "labor_category_code", v)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LABOR_CATEGORY_OPTIONS.map((o) => (
                          <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">Horas</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.25"
                      value={op.hours}
                      onChange={(e) => updateOp(idx, "hours", e.target.value)}
                      className="bg-white/5 border-white/10 text-white h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/50 text-xs">R$/hora</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={op.hourly_rate}
                      onChange={(e) => updateOp(idx, "hourly_rate", e.target.value)}
                      className="bg-white/5 border-white/10 text-white h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60 font-medium">
                      = {(parseFloat(op.hours || "0") * parseFloat(op.hourly_rate || "0"))
                          .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOp(idx)}
                      className="text-white/20 hover:text-error-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              className="flex-1 text-white/50 hover:text-white border border-white/10"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={isPending}
              onClick={handleSave}
            >
              {isPending ? "Salvando..." : "Salvar Item"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
