"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { InsurerSelect } from "../shared/InsurerSelect"
import { ExpertCombobox } from "../shared/ExpertCombobox"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"
const INPUT = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
const SELECT = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface InsurerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function InsurerSection({ form }: InsurerSectionProps) {
  const { register, control, watch, setValue, formState: { errors } } = form
  const insuredType = watch("insured_type")
  const insurerId = watch("insurer")

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-2">
        <span className={SECTION_TITLE}>Seguradora</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Seguradora */}
        <div className="col-span-full sm:col-span-2">
          <label className={LABEL}>Seguradora *</label>
          <Controller
            name="insurer"
            control={control}
            render={({ field }) => (
              <InsurerSelect
                value={field.value ?? null}
                onChange={(id) => field.onChange(id)}
              />
            )}
          />
          {errors.insurer && (
            <p className="mt-1 text-xs text-red-600">{errors.insurer.message}</p>
          )}
        </div>

        {/* Tipo de segurado */}
        <div>
          <label className={LABEL}>Segurado ou Terceiro *</label>
          <Controller
            name="insured_type"
            control={control}
            render={({ field }) => (
              <select className={SELECT} {...field} value={field.value ?? ""}>
                <option value="">Selecionar...</option>
                <option value="insured">Segurado</option>
                <option value="third">Terceiro</option>
              </select>
            )}
          />
          {errors.insured_type && (
            <p className="mt-1 text-xs text-red-600">{errors.insured_type.message}</p>
          )}
        </div>

        {/* Número do sinistro */}
        <div>
          <label className={LABEL}>Número do sinistro</label>
          <input className={INPUT} type="text" placeholder="Ex: 2024/001234" {...register("casualty_number")} />
        </div>

        {/* Franquia (só para segurado) */}
        {insuredType === "insured" && (
          <div>
            <label className={LABEL}>Valor da franquia</label>
            <input
              className={INPUT}
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              {...register("deductible_amount", { valueAsNumber: true })}
            />
          </div>
        )}

        {/* Corretor */}
        <div>
          <label className={LABEL}>Corretor</label>
          <input className={INPUT} type="text" placeholder="Nome do corretor" {...register("broker_name")} />
        </div>

        {/* Perito */}
        <div className="col-span-full sm:col-span-2">
          <label className={LABEL}>Perito</label>
          <Controller
            name="expert"
            control={control}
            render={({ field }) => (
              <ExpertCombobox
                value={field.value ?? null}
                onChange={(id) => field.onChange(id)}
                insurerId={insurerId}
              />
            )}
          />
        </div>

        {/* Data do perito */}
        <div>
          <label className={LABEL}>Data visita perito</label>
          <input className={INPUT} type="date" {...register("expert_date")} />
        </div>

        {/* Data da vistoria */}
        <div>
          <label className={LABEL}>Data da vistoria</label>
          <input className={INPUT} type="date" {...register("survey_date")} />
        </div>

        {/* Data de autorização */}
        <div>
          <label className={LABEL}>Data de autorização</label>
          <input className={INPUT} type="datetime-local" {...register("authorization_date")} />
          <p className="mt-1 text-xs text-amber-600">Preencher muda status automaticamente</p>
        </div>
      </div>
    </div>
  )
}
