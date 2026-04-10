"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useConsultants } from "../../_hooks/useStaff"
import { Loader2 } from "lucide-react"

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-[#ea0e03]"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"
const SELECT_NATIVE = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface OpeningInfoSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function OpeningInfoSection({ form }: OpeningInfoSectionProps) {
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
              <Select
                value={field.value ?? ""}
                onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)}
              >
                <SelectTrigger className="h-9" disabled={loadingConsultants}>
                  <SelectValue placeholder="Selecionar consultor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-neutral-400">Nenhum</span>
                  </SelectItem>
                  {consultants.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span>{c.name}</span>
                      {c.job_title_display && (
                        <span className="ml-1 text-xs text-neutral-400">({c.job_title_display})</span>
                      )}
                    </SelectItem>
                  ))}
                  {consultants.length === 0 && !loadingConsultants && (
                    <div className="px-2 py-1.5 text-sm text-neutral-400 select-none">
                      Nenhum consultor cadastrado no RH
                    </div>
                  )}
                </SelectContent>
              </Select>
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
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insurer">Seguradora</SelectItem>
                  <SelectItem value="private">Particular</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.customer_type && (
            <p className="mt-1 text-xs text-red-600">{errors.customer_type.message}</p>
          )}
        </div>

        {/* Tipo de OS */}
        <div>
          <label className={LABEL}>Tipo de OS</label>
          <select className={SELECT_NATIVE} {...register("os_type")}>
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
