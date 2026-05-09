"use client"

import type { UseFormReturn, FieldArrayWithId } from "react-hook-form"
import { Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ManualFormValues } from "./TabManual"

export function ItemRow({
  form,
  field,
  index,
  totalFields,
  onRemove,
}: {
  form: UseFormReturn<ManualFormValues>
  field: FieldArrayWithId<ManualFormValues, "itens", "id">
  index: number
  totalFields: number
  onRemove: (index: number) => void
}) {
  return (
    <div
      key={field.id}
      className="rounded-lg border border-border bg-white/[0.02] p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={totalFields === 1}
          className="p-1 rounded text-muted-foreground hover:text-error-400 disabled:opacity-20 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Linha 1: descrição + código produto */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">
            Descrição <span className="text-error-400">*</span>
          </Label>
          <Input
            className="mt-0.5 text-xs"
            placeholder="Ex: Amortecedor dianteiro direito"
            {...form.register(`itens.${index}.descricao`)}
          />
          {form.formState.errors.itens?.[index]?.descricao && (
            <p className="mt-0.5 text-xs text-error-400">
              {form.formState.errors.itens[index]?.descricao?.message}
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Código Produto</Label>
          <Input
            className="mt-0.5 text-xs font-mono"
            placeholder="Ex: ATS-001"
            {...form.register(`itens.${index}.codigo_produto`)}
          />
        </div>
      </div>

      {/* Linha 2: NCM + unidade + qtd + valor unit */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">
            NCM <span className="text-error-400">*</span>
          </Label>
          <Input
            className="mt-0.5 text-xs font-mono"
            placeholder="87089990"
            maxLength={10}
            {...form.register(`itens.${index}.ncm`)}
          />
          {form.formState.errors.itens?.[index]?.ncm && (
            <p className="mt-0.5 text-xs text-error-400">
              {form.formState.errors.itens[index]?.ncm?.message}
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Unid.</Label>
          <Input
            className="mt-0.5 text-xs"
            placeholder="UN"
            maxLength={6}
            {...form.register(`itens.${index}.unidade`)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Qtd</Label>
          <Input
            className="mt-0.5 text-xs"
            placeholder="1.0000"
            {...form.register(`itens.${index}.quantidade`)}
          />
          {form.formState.errors.itens?.[index]?.quantidade && (
            <p className="mt-0.5 text-xs text-error-400">!</p>
          )}
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Preço Unit.</Label>
          <Input
            className="mt-0.5 text-xs"
            placeholder="0.00"
            {...form.register(`itens.${index}.valor_unitario`)}
          />
          {form.formState.errors.itens?.[index]?.valor_unitario && (
            <p className="mt-0.5 text-xs text-error-400">!</p>
          )}
        </div>
      </div>
    </div>
  )
}
