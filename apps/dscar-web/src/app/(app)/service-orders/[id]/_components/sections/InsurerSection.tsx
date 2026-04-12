"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { InsurerLogo } from "../shared/InsurerSelect"
import { ExpertCombobox } from "../shared/ExpertCombobox"
import { useInsurers } from "../../_hooks/useInsurers"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT = "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
const SELECT = "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface InsurerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function InsurerSection({ form }: InsurerSectionProps) {
  const { register, control, watch, formState: { errors } } = form
  const insuredType = watch("insured_type")
  const insurerId = watch("insurer")

  const { data } = useInsurers()
  const insurers = data?.results ?? []
  const selectedInsurer = insurers.find((i) => i.id === insurerId) ?? null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={SECTION_TITLE}>Seguradora</span>
      </div>

      {/* Main layout: logo hero on left, fields on right */}
      <div className="flex items-start gap-4">

        {/* Logo — the hero */}
        <InsurerLogo insurer={selectedInsurer} />

        {/* All fields — compact grid */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Row 1: Dropdown + Tipo */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className={LABEL}>Seguradora</label>
              <Controller
                name="insurer"
                control={control}
                render={({ field }) => (
                  <select
                    className={SELECT}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  >
                    <option value="">Selecione...</option>
                    {insurers.map((ins) => (
                      <option key={ins.id} value={ins.id}>{ins.display_name}</option>
                    ))}
                  </select>
                )}
              />
              {errors.insurer && <p className="mt-0.5 text-[10px] text-red-600">{errors.insurer.message}</p>}
            </div>

            <div className="w-36 shrink-0">
              <label className={LABEL}>Tipo</label>
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
            </div>
          </div>

          {/* Row 2: Sinistro + Corretor + Franquia */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={LABEL}>Sinistro</label>
              <input className={INPUT} type="text" placeholder="Ex: 2024/001234" {...register("casualty_number")} />
            </div>
            <div>
              <label className={LABEL}>Corretor</label>
              <input className={INPUT} type="text" placeholder="Nome do corretor" {...register("broker_name")} />
            </div>
            {insuredType === "insured" && (
              <div>
                <label className={LABEL}>Franquia (R$)</label>
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
          </div>

          {/* Row 3: Perito + Visita */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
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
            <div>
              <label className={LABEL}>Visita perito</label>
              <input className={INPUT} type="date" {...register("expert_date")} />
            </div>
          </div>

          {/* Row 4: Datas */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={LABEL}>Vistoria</label>
              <input className={INPUT} type="date" {...register("survey_date")} />
            </div>
            <div>
              <label className={LABEL}>Autorização</label>
              <input className={INPUT} type="datetime-local" {...register("authorization_date")} />
              <p className="mt-0.5 text-[10px] text-amber-600 font-medium">Preencher muda status</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
