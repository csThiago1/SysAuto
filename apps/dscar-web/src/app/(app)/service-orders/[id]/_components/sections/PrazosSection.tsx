"use client"

import { useEffect } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { DateTimeNow } from "../shared/DateTimeNow"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface PrazosSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function PrazosSection({ form }: PrazosSectionProps) {
  const { register, control, watch, setValue } = form
  const entryDate = watch("entry_date")
  const repairDays = watch("repair_days")

  // Auto-calcula previsão de entrega
  useEffect(() => {
    if (entryDate && repairDays && repairDays > 0) {
      const entry = new Date(entryDate)
      entry.setDate(entry.getDate() + repairDays)
      const yyyy = entry.getFullYear()
      const mm = String(entry.getMonth() + 1).padStart(2, "0")
      const dd = String(entry.getDate()).padStart(2, "0")
      setValue("estimated_delivery_date", `${yyyy}-${mm}-${dd}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryDate, repairDays, setValue])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={SECTION_TITLE}>Prazos e Entrega</span>
      </div>

      {/* Dias de reparo | Previsão (auto) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Dias de reparo</label>
          <input
            className={INPUT}
            type="number"
            min="1"
            placeholder="Ex: 10"
            {...register("repair_days", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className={LABEL}>Previsão de entrega</label>
          <input
            className={`${INPUT} bg-neutral-50 cursor-default`}
            type="date"
            readOnly
            {...register("estimated_delivery_date")}
          />
          <p className="mt-0.5 text-[9px] text-neutral-400">Entrada + dias de reparo</p>
        </div>
      </div>

      {/* Vistoria final | Entrega ao cliente */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Vistoria final</label>
          <Controller
            name="final_survey_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
          <p className="mt-0.5 text-[9px] text-amber-600">Muda status → Vistoria Final</p>
        </div>
        <div>
          <label className={LABEL}>Entrega ao cliente</label>
          <Controller
            name="client_delivery_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
          <p className="mt-0.5 text-[9px] text-amber-600">Muda status → Entregue</p>
        </div>
      </div>

      {/* Entrega real (delivery_date) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Data real de entrega</label>
          <Controller
            name="delivery_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
        </div>
      </div>
    </div>
  )
}
