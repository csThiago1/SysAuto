"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useServiceCatalogCreate,
  useServiceCatalogUpdate,
} from "@/hooks/useServiceCatalog"
import type { ServiceCatalogDetail } from "@paddock/types"
import { SERVICE_CATALOG_CATEGORY_LABELS } from "@paddock/types"

const schema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  description: z.string().optional(),
  category: z.enum([
    "funilaria", "pintura", "mecanica", "eletrica",
    "estetica", "alinhamento", "revisao", "lavagem", "outros",
  ]),
  suggested_price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço inválido"),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ServiceCatalogDetail | null
}

const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT = "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
const SELECT = INPUT

export function ServiceCatalogDialog({ open, onOpenChange, editing }: Props) {
  const create = useServiceCatalogCreate()
  const update = useServiceCatalogUpdate(editing?.id ?? "")

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        description: editing.description,
        category: editing.category,
        suggested_price: editing.suggested_price,
      })
    } else {
      reset({ name: "", description: "", category: "outros", suggested_price: "0.00" })
    }
  }, [open, editing, reset])

  async function onSubmit(data: FormData) {
    try {
      if (editing) {
        await update.mutateAsync(data)
        toast.success("Serviço atualizado.")
      } else {
        await create.mutateAsync(data)
        toast.success("Serviço criado.")
      }
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar serviço.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{editing ? "Editar Serviço" : "Novo Serviço"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className={LABEL}>Nome *</label>
            <Input className="h-8" placeholder="Ex: Pintura Completa" {...register("name")} />
            {errors.name && <p className="mt-0.5 text-[10px] text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className={LABEL}>Categoria *</label>
            <select className={SELECT} {...register("category")}>
              {Object.entries(SERVICE_CATALOG_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL}>Preço Sugerido (R$) *</label>
            <Input className="h-8" placeholder="0.00" {...register("suggested_price")} />
            {errors.suggested_price && (
              <p className="mt-0.5 text-[10px] text-red-600">{errors.suggested_price.message}</p>
            )}
          </div>

          <div>
            <label className={LABEL}>Descrição / Observação</label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              placeholder="Detalhes opcionais para orçamento..."
              {...register("description")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#ea0e03] hover:bg-red-700 text-white">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {editing ? "Salvar" : "Criar Serviço"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
