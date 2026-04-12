"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { DateTimeNow } from "../shared/DateTimeNow"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"

interface FinalSurveySectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function FinalSurveySection({ form }: FinalSurveySectionProps) {
  const { control } = form

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-2">
        <span className={SECTION_TITLE}>Vistoria Final e Entrega</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Vistoria final */}
        <div>
          <label className={LABEL}>Data/hora da vistoria final</label>
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
          <p className="mt-1 text-xs text-amber-600">Preencher muda status para Vistoria Final</p>
        </div>

        {/* Entrega ao cliente */}
        <div>
          <label className={LABEL}>Data/hora de entrega ao cliente</label>
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
          <p className="mt-1 text-xs text-amber-600">Preencher muda status para Entregue</p>
        </div>
      </div>
    </div>
  )
}
