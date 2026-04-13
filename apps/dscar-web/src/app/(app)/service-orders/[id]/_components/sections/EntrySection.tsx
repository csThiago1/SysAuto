"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { DateTimeNow } from "../shared/DateTimeNow"
import { cn } from "@/lib/utils"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
const INPUT_ERROR =
  "flex h-8 w-full rounded-md border border-red-500 bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"

interface EntrySectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function EntrySection({ form }: EntrySectionProps) {
  const { register, control, formState: { errors } } = form

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={SECTION_TITLE}>Entrada</span>
      </div>

      {/* Linha 1: Data (2/4) | KM (1/4) | Local (1/4) */}
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className={LABEL}>Data / hora entrada</label>
          <Controller
            name="entry_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
                error={errors.entry_date?.message}
              />
            )}
          />
          {!errors.entry_date && (
            <p className="mt-0.5 text-xs text-amber-600">Preencher muda status</p>
          )}
        </div>
        <div>
          <label className={LABEL}>KM entrada</label>
          <input
            className={cn(errors.mileage_in ? INPUT_ERROR : INPUT)}
            type="number"
            placeholder="0"
            {...register("mileage_in", { valueAsNumber: true })}
          />
          {errors.mileage_in && (
            <p className="mt-0.5 text-[10px] text-red-500">{errors.mileage_in.message}</p>
          )}
        </div>
        <div>
          <label className={LABEL}>Localização</label>
          <select className={INPUT} {...register("vehicle_location")}>
            <option value="workshop">Na Oficina</option>
            <option value="in_transit">Em Trânsito</option>
          </select>
        </div>
      </div>

      {/* Linha 2: Autorização | Agendamento */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>Autorização do serviço</label>
          <Controller
            name="service_authorization_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
                error={errors.service_authorization_date?.message}
              />
            )}
          />
        </div>
        <div>
          <label className={LABEL}>Agendamento</label>
          <Controller
            name="scheduling_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
                error={errors.scheduling_date?.message}
              />
            )}
          />
        </div>
      </div>
    </div>
  )
}
