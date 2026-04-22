"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { addDays, format } from "date-fns"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useScheduleOS } from "@/hooks/useAgenda"
import { useServiceOrders } from "@/hooks"

const schema = z.object({
  osId: z.string().uuid("Selecione uma OS"),
  scheduling_date: z.string().min(1, "Data/hora obrigatória"),
  repair_days: z.coerce.number().int().min(0).nullable(),
})
type FormData = z.infer<typeof schema>

const LABEL = "block text-xs font-bold uppercase tracking-wide text-white/40 mb-0.5"
const INPUT = "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultDate?: Date
}

export function SchedulingDialog({ open, onOpenChange, defaultDate }: Props) {
  const [osSearch, setOsSearch] = useState("")
  const [selectedOsLabel, setSelectedOsLabel] = useState("")
  const scheduleMutation = useScheduleOS()

  const { data: osData } = useServiceOrders(
    osSearch.length >= 3 ? { search: osSearch, status: "reception" } : {}
  )

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        scheduling_date: defaultDate
          ? format(defaultDate, "yyyy-MM-dd'T'HH:mm")
          : format(new Date(), "yyyy-MM-dd'T'09:00"),
        repair_days: null,
      },
    })

  const repairDays = watch("repair_days")
  const schedulingDate = watch("scheduling_date")

  const estimatedDelivery = repairDays && schedulingDate
    ? format(addDays(new Date(schedulingDate), repairDays), "yyyy-MM-dd")
    : null

  function selectOS(id: string, label: string) {
    setValue("osId", id)
    setSelectedOsLabel(label)
    setOsSearch("")
  }

  async function onSubmit(data: FormData) {
    try {
      await scheduleMutation.mutateAsync({
        osId: data.osId,
        payload: {
          scheduling_date: data.scheduling_date ? new Date(data.scheduling_date).toISOString() : null,
          repair_days: data.repair_days,
          estimated_delivery_date: estimatedDelivery,
        },
      })
      toast.success("OS agendada com sucesso.")
      reset()
      setSelectedOsLabel("")
      onOpenChange(false)
    } catch {
      toast.error("Erro ao agendar OS.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar OS</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Busca OS */}
          <div>
            <label className={LABEL}>OS *</label>
            {selectedOsLabel ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/90 flex-1">{selectedOsLabel}</span>
                <button
                  type="button"
                  className="text-xs text-white/40 hover:text-white/60"
                  onClick={() => { setValue("osId", ""); setSelectedOsLabel("") }}
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
                <input
                  className={`${INPUT} pl-8`}
                  placeholder="Buscar por placa, número ou cliente..."
                  value={osSearch}
                  onChange={(e) => setOsSearch(e.target.value)}
                />
                {osData && osData.results.length > 0 && osSearch.length >= 3 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-white/10 bg-white/5 shadow-lg max-h-48 overflow-y-auto">
                    {osData.results.map((os) => (
                      <button
                        key={os.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.03]"
                        onMouseDown={() => selectOS(os.id, `OS #${os.number} — ${os.plate} / ${os.customer_name ?? "s/cliente"}`)}
                      >
                        <span className="font-medium">OS #{os.number}</span>
                        <span className="ml-2 text-white/50">{os.plate}</span>
                        {os.customer_name && <span className="ml-2 text-white/40 text-xs">{os.customer_name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.osId && <p className="mt-0.5 text-xs text-red-600">{errors.osId.message}</p>}
          </div>

          {/* Data/hora entrada */}
          <div>
            <label className={LABEL}>Data e Hora de Entrada *</label>
            <input type="datetime-local" className={INPUT} {...register("scheduling_date")} />
            {errors.scheduling_date && (
              <p className="mt-0.5 text-xs text-red-600">{errors.scheduling_date.message}</p>
            )}
          </div>

          {/* Dias de reparo */}
          <div>
            <label className={LABEL}>Dias de Reparo</label>
            <input type="number" min="0" className={INPUT} placeholder="Ex: 5" {...register("repair_days")} />
            {estimatedDelivery && (
              <p className="mt-0.5 text-xs text-emerald-600">
                Previsão de entrega: {new Date(estimatedDelivery + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary-600 hover:bg-primary-700 text-white">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Salvar Agendamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
