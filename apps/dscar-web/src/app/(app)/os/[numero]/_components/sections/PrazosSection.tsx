"use client"

import { useEffect } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { FORM_SECTION_TITLE, FORM_SUBSECTION, FORM_INPUT, FORM_INPUT_ERROR, FORM_ERROR } from "@paddock/utils"
import { DateTimeNow } from "../shared/DateTimeNow"
import { FieldLabel } from "../shared/FieldLabel"
import { cn } from "@/lib/utils"

interface PrazosSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function PrazosSection({ form }: PrazosSectionProps) {
  const { register, control, watch, setValue, formState: { errors } } = form
  const entryDate = watch("entry_date")
  const repairDays = watch("repair_days")

  // Auto-calcula previsão de entrega a partir de entrada + dias de reparo
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
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-2">
        <span className={FORM_SECTION_TITLE}>Agendamentos</span>
      </div>

      {/* ── 1. Agendamentos lado a lado ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div>
          <FieldLabel statusHint="Preencher muda o status → Vistoria Inicial">
            Data de Agendamento
          </FieldLabel>
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
        <div>
          <FieldLabel hint="Data planejada para conclusão do reparo">
            Previsão de Entrega
          </FieldLabel>
          <Controller
            name="delivery_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
                error={errors.delivery_date?.message}
              />
            )}
          />
        </div>
      </div>

      {/* ── 2. Previsão (auto-calculada) ─────────────────────────────── */}
      <p className={FORM_SUBSECTION}>Previsão de reparo</p>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div>
          <FieldLabel>Dias de reparo</FieldLabel>
          <input
            className={cn(errors.repair_days ? FORM_INPUT_ERROR : FORM_INPUT)}
            type="number"
            min="1"
            placeholder="Ex: 10"
            {...register("repair_days", { valueAsNumber: true })} aria-invalid={!!errors.repair_days}
          />
          {errors.repair_days && (
            <p className={FORM_ERROR}>{errors.repair_days.message}</p>
          )}
        </div>
        <div>
          <FieldLabel hint="Calculada automaticamente: entrada + dias de reparo">
            Previsão de Entrega (calculada)
          </FieldLabel>
          <input
            className={`${FORM_INPUT} cursor-default opacity-70`}
            type="date"
            readOnly
            {...register("estimated_delivery_date")} aria-invalid={!!errors.estimated_delivery_date}
          />
        </div>
      </div>

      {/* ── 3. Registros automáticos (disparam status ao serem preenchidos) */}
      <p className={FORM_SUBSECTION}>Registros automáticos de status</p>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div>
          <FieldLabel statusHint="Preencher muda o status → Vistoria Final">
            Vistoria final
          </FieldLabel>
          <Controller
            name="final_survey_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
                error={errors.final_survey_date?.message}
              />
            )}
          />
        </div>
        <div>
          <FieldLabel statusHint="Preencher muda o status → Entregue">
            Data de Retirada pelo Cliente
          </FieldLabel>
          <Controller
            name="client_delivery_date"
            control={control}
            render={({ field }) => (
              <DateTimeNow
                value={field.value ? field.value.slice(0, 16) : ""}
                onChange={field.onChange}
                onSetNow={(iso) => field.onChange(iso)}
                error={errors.client_delivery_date?.message}
              />
            )}
          />
        </div>
      </div>
    </div>
  )
}
