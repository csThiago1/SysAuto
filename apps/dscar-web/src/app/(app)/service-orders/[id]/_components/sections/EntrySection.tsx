"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { FORM_SECTION_TITLE, FORM_LABEL, FORM_INPUT, FORM_INPUT_ERROR, FORM_ERROR, FORM_WARN } from "@paddock/utils"
import { DateTimeNow } from "../shared/DateTimeNow"
import { cn } from "@/lib/utils"

interface EntrySectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function EntrySection({ form }: EntrySectionProps) {
  const { register, control, formState: { errors } } = form

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={FORM_SECTION_TITLE}>Entrada</span>
      </div>

      {/* Linha 1: Data (2/4) | KM (1/4) | Local (1/4) */}
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className={FORM_LABEL}>Data / hora entrada</label>
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
            <p className={FORM_WARN}>Preencher muda status</p>
          )}
        </div>
        <div>
          <label className={FORM_LABEL}>KM entrada</label>
          <input
            className={cn(errors.mileage_in ? FORM_INPUT_ERROR : FORM_INPUT)}
            type="number"
            placeholder="0"
            {...register("mileage_in", { valueAsNumber: true })}
          />
          {errors.mileage_in && (
            <p className={FORM_ERROR}>{errors.mileage_in.message}</p>
          )}
        </div>
        <div>
          <label className={FORM_LABEL}>Localização</label>
          <select className={FORM_INPUT} {...register("vehicle_location")}>
            <option value="workshop">Na Oficina</option>
            <option value="in_transit">Em Trânsito</option>
          </select>
        </div>
      </div>

      {/* Linha 2: Autorização */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={FORM_LABEL}>Autorização do serviço</label>
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
      </div>
    </div>
  )
}
