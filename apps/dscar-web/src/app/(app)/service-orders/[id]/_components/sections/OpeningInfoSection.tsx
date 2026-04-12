"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { useConsultants } from "../../_hooks/useStaff"
import { Loader2 } from "lucide-react"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"
const SELECT = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface OpeningInfoSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  consultantName?: string
}

export function OpeningInfoSection({ form, consultantName: _consultantName }: OpeningInfoSectionProps) {
  const { register, control, formState: { errors } } = form
  const { data: consultants = [], isLoading: loadingConsultants } = useConsultants()

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-2">
        <span className={SECTION_TITLE}>Informações de Abertura</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Consultor — filtrado do HR */}
        <div>
          <label className={LABEL}>
            Consultor
            {loadingConsultants && <Loader2 className="inline ml-1.5 h-3 w-3 animate-spin text-neutral-400" />}
          </label>
          <Controller
            name="consultant_id"
            control={control}
            render={({ field }) => (
              <select
                className={SELECT}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
                disabled={loadingConsultants}
              >
                <option value="">Selecionar consultor...</option>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.job_title_display ? ` (${c.job_title_display})` : ""}
                  </option>
                ))}
              </select>
            )}
          />
        </div>

        {/* Tipo de atendimento */}
        <div>
          <label className={LABEL}>Tipo de atendimento *</label>
          <Controller
            name="customer_type"
            control={control}
            render={({ field }) => (
              <select
                className={SELECT}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
              >
                <option value="">Selecionar...</option>
                <option value="insurer">Seguradora</option>
                <option value="private">Particular</option>
              </select>
            )}
          />
          {errors.customer_type && (
            <p className="mt-1 text-xs text-red-600">{errors.customer_type.message}</p>
          )}
        </div>

        {/* Tipo de OS */}
        <div>
          <label className={LABEL}>Tipo de OS</label>
          <select className={SELECT} {...register("os_type")}>
            <option value="">Selecionar...</option>
            <option value="bodywork">Chapeação</option>
            <option value="warranty">Garantia</option>
            <option value="rework">Retrabalho</option>
            <option value="mechanical">Mecânica</option>
            <option value="aesthetic">Estética</option>
          </select>
        </div>
      </div>
    </div>
  )
}
