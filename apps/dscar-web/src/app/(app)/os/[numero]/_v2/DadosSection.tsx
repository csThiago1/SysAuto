"use client"

/**
 * Seção "Dados" da OS v2 — form de abertura (cliente/veículo/prazos).
 *
 * Reusa o OpeningTab e o schema/mutations da v1; a diferença é a casca:
 * barra de salvar sticky que só aparece quando há alterações.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import type { ServiceOrder } from "@paddock/types"
import { ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { serviceOrderUpdateSchema, type ServiceOrderUpdateInput } from "../_schemas/service-order.schema"
import { buildFormDefaults } from "../_utils/form-defaults"
import { useServiceOrderUpdate } from "../_hooks/useServiceOrder"
import { usePersonUpdate, type PersonPatch } from "../_hooks/useCustomerSearch"
import { OpeningTab } from "../_components/tabs/OpeningTab"

interface DadosSectionProps {
  order: ServiceOrder
}

export function DadosSection({ order }: DadosSectionProps) {
  const router = useRouter()
  const [personDirtyData, setPersonDirtyData] = useState<PersonPatch | null>(null)

  const form = useForm<ServiceOrderUpdateInput>({
    resolver: zodResolver(serviceOrderUpdateSchema),
    defaultValues: buildFormDefaults(order),
  })

  const { dirtyFields } = form.formState
  // isDirty do RHF fica true por causa de z.preprocess — usar dirtyFields.
  const isDirty = Object.keys(dirtyFields).length > 0 || personDirtyData !== null

  const updateMutation = useServiceOrderUpdate(order.id)
  const personUpdateMutation = usePersonUpdate(order.customer_person_id ?? null)
  const isPending = updateMutation.isPending || personUpdateMutation.isPending

  async function onSubmit(data: ServiceOrderUpdateInput) {
    try {
      const patch: Record<string, unknown> = {}
      for (const key of Object.keys(dirtyFields)) {
        patch[key] = data[key as keyof ServiceOrderUpdateInput]
      }
      const savedOrder = await updateMutation.mutateAsync(patch as ServiceOrderUpdateInput)
      form.reset(buildFormDefaults(savedOrder))
      if (personDirtyData && order.customer_person_id) {
        await personUpdateMutation.mutateAsync(personDirtyData)
        setPersonDirtyData(null)
      }
      toast.success("Dados salvos.")
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          form.setError(field as keyof ServiceOrderUpdateInput, {
            type: "server",
            message: messages[0],
          })
        }
        toast.error("Erro de validação. Verifique os campos destacados.")
      } else {
        toast.error("Erro ao salvar. Tente novamente.")
      }
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="relative pb-16">
      <OpeningTab form={form} order={order} onPersonDataChange={setPersonDirtyData} />

      {/* Barra de salvar — só aparece com alterações pendentes */}
      {isDirty && (
        <div className="sticky bottom-0 z-10 -mx-5 mt-4 flex items-center justify-between border-t border-border bg-background/95 px-5 py-3 backdrop-blur">
          <p className="text-xs text-muted-foreground">Alterações não salvas</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                form.reset(buildFormDefaults(order))
                setPersonDirtyData(null)
              }}
            >
              Descartar
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}
