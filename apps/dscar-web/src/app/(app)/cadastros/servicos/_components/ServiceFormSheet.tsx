"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
  suggested_price: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Informe um valor válido, ex: 250,00")
    .transform(v => v.replace(",", ".")),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: ServiceCatalogDetail | null
}

export function ServiceFormSheet({ open, onOpenChange, editing }: Props) {
  const create = useServiceCatalogCreate()
  const update = useServiceCatalogUpdate(editing?.id ?? "")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              description: editing.description ?? "",
              category: editing.category,
              suggested_price: Number(editing.suggested_price).toFixed(2).replace(".", ","),
            }
          : { name: "", description: "", category: "outros", suggested_price: "" }
      )
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
      toast.error("Erro ao salvar. Tente novamente.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{editing ? "Editar Serviço" : "Novo Serviço"}</SheetTitle>
          <SheetDescription>
            {editing ? "Altere os dados e salve." : "Preencha para adicionar ao catálogo."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Nome *</label>
            <Input
              placeholder="Ex: Pintura de capô"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Categoria */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Categoria *</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              {...register("category")}
            >
              {Object.entries(SERVICE_CATALOG_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Preço */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Preço (R$) *</label>
            <Input
              placeholder="Ex: 280,00"
              {...register("suggested_price")}
            />
            {errors.suggested_price && (
              <p className="text-xs text-red-600">{errors.suggested_price.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">
              Descrição <span className="text-neutral-400 font-normal">(opcional)</span>
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              placeholder="Detalhes do serviço…"
              {...register("description")}
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
