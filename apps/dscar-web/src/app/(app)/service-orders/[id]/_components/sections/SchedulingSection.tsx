"use client"

import { useEffect } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { DateTimeNow } from "../shared/DateTimeNow"

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-[#ea0e03]"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"
const INPUT = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface SchedulingSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function SchedulingSection({ form }: SchedulingSectionProps) {
  const { register, control, watch, setValue } = form
  const entryDate = watch("entry_date")
  const repairDays = watch("repair_days")

  // Calcular previsão de entrega automaticamente
  useEffect(() => {
    if (entryDate && repairDays && repairDays > 0) {
      const entry = new Date(entryDate)
      entry.setDate(entry.getDate() + repairDays)
      const yyyy = entry.getFullYear()
      const mm = String(entry.getMonth() + 1).padStart(2, "0")
      const dd = String(entry.getDate()).padStart(2, "0")
      setValue("estimated_delivery_date", `${yyyy}-${mm}-${dd}`)
    }
  }, [entryDate, repairDays, setValue])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-2">
        <span className={SECTION_TITLE}>Agendamento e Previsão</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Agendamento */}
        <div>
          <label className={LABEL}>Data de agendamento</label>
          <Controller
            name="scheduling_date"
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

        {/* Dias de reparo */}
        <div>
          <label className={LABEL}>Dias estimados de reparo</label>
          <input
            className={INPUT}
            type="number"
            min="1"
            placeholder="Ex: 10"
            {...register("repair_days", { valueAsNumber: true })}
          />
        </div>

        {/* Previsão de entrega (calculado automaticamente) */}
        <div>
          <label className={LABEL}>Previsão de entrega</label>
          <input
            className={`${INPUT} bg-gray-50`}
            type="date"
            readOnly
            {...register("estimated_delivery_date")}
          />
          <p className="mt-1 text-xs text-gray-500">Calculado: entrada + dias de reparo</p>
        </div>

        {/* Data de entrega real */}
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
