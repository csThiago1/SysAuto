"use client"

import { type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { DateTimeNow } from "../shared/DateTimeNow"
import { Controller } from "react-hook-form"

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-[#ea0e03]"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"
const INPUT = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface PrivateSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function PrivateSection({ form }: PrivateSectionProps) {
  const { register, control } = form

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-2">
        <span className={SECTION_TITLE}>Particular</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Data do orçamento */}
        <div>
          <label className={LABEL}>Data do orçamento</label>
          <input className={INPUT} type="date" {...register("quotation_date")} />
        </div>

        {/* Data de autorização (compartilhada) */}
        <div>
          <label className={LABEL}>Data de autorização</label>
          <Controller
            name="authorization_date"
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
      </div>
    </div>
  )
}
