"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { DateTimeNow } from "../shared/DateTimeNow"

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-[#ea0e03]"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"
const SELECT = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface EntrySectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function EntrySection({ form }: EntrySectionProps) {
  const { register, control } = form

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-2">
        <span className={SECTION_TITLE}>Entrada do Veículo</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Local do veículo */}
        <div>
          <label className={LABEL}>Local do veículo</label>
          <select className={SELECT} {...register("vehicle_location")}>
            <option value="workshop">Na Oficina</option>
            <option value="in_transit">Em Trânsito</option>
          </select>
        </div>

        {/* Data de entrada */}
        <div>
          <label className={LABEL}>Data/hora de entrada</label>
          <Controller
            name="entry_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
              />
            )}
          />
          <p className="mt-1 text-xs text-amber-600">Preencher muda status automaticamente</p>
        </div>

        {/* Autorização do serviço */}
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
              />
            )}
          />
        </div>
      </div>
    </div>
  )
}
