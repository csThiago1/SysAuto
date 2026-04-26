"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { CheckCircle2 } from "lucide-react"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { FORM_SECTION_TITLE, FORM_LABEL, FORM_INPUT, FORM_INPUT_ERROR, FORM_ERROR, FORM_WARN } from "@paddock/utils"
import { DateTimeNow } from "../shared/DateTimeNow"
import { cn } from "@/lib/utils"

interface EntrySectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  order?: {
    nfe_key: string
    nfse_number: string
    invoice_issued: boolean
  }
}

export function EntrySection({ form, order }: EntrySectionProps) {
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

      {/* Documentos fiscais — somente leitura */}
      {order && (order.nfe_key || order.nfse_number || order.invoice_issued) && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">
            Documentos Fiscais
          </p>
          {order.invoice_issued && (
            <div className="flex items-center gap-1.5 text-xs text-success-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Nota fiscal emitida</span>
            </div>
          )}
          {order.nfe_key && (
            <div className="space-y-0.5">
              <p className="text-xs text-white/50">Chave NF-e</p>
              <p className={cn("text-xs font-mono text-white/90 break-all bg-white/5 rounded px-2 py-1", order.nfe_key.replace(/\D/g, "").length !== 44 && "text-amber-700 bg-amber-50")}>
                {order.nfe_key}
              </p>
              {order.nfe_key.replace(/\D/g, "").length !== 44 && (
                <p className="text-xs text-amber-600">Chave NF-e inválida — esperado 44 dígitos</p>
              )}
            </div>
          )}
          {order.nfse_number && (
            <div className="space-y-0.5">
              <p className="text-xs text-white/50">Número NFS-e</p>
              <p className="text-xs font-mono text-white/90 bg-white/5 rounded px-2 py-1">
                {order.nfse_number}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
