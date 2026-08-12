"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrder } from "@paddock/types"
import { FORM_INPUT, FORM_LABEL } from "@paddock/utils"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { InsurerLogo } from "../shared/InsurerSelect"
import { ExpertCombobox } from "../shared/ExpertCombobox"
import { useInsurers } from "../../_hooks/useInsurers"
import { NativeSelect } from "@/components/ui/native-select"
import { DateField } from "@/components/ui/date-field"

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-muted-foreground"
// Um unico sistema de campo na tela de OS — antes cada secao tinha o seu.
const LABEL = FORM_LABEL
const INPUT = FORM_INPUT

interface InsurerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  /** O container ja rotula a secao (Panel "Seguradora") — nao repetir. */
  hideHeading?: boolean
  /** OS carregada da API — insurer_detail/expert_detail já vêm resolvidos,
   * evita depender só da lista (paginada/filtrada) pra achar o nome. */
  order?: Pick<ServiceOrder, "insurer_detail" | "expert_detail">
}

export function InsurerSection({ form, order, hideHeading }: InsurerSectionProps) {
  const { register, control, watch, formState: { errors } } = form
  const insuredType = watch("insured_type")
  const insurerId = watch("insurer")

  const { data } = useInsurers()
  const insurers = data?.results ?? []
  const knownInsurer = order?.insurer_detail ?? null
  const selectedInsurer =
    insurers.find((i) => i.id === insurerId) ?? (knownInsurer?.id === insurerId ? knownInsurer : null)

  return (
    <div className="space-y-2">
      {!hideHeading && (
        <div className="flex items-center gap-3 border-b pb-1.5">
          <span className={SECTION_TITLE}>Seguradora</span>
        </div>
      )}

      {/* Uma unica grade de 6 colunas: antes o logo era um trilho lateral que
          deixava a coluna vazia nas linhas seguintes, e cada linha usava um
          sistema proprio (flex, cols-3), entao nada se alinhava na vertical. */}
      <div className="space-y-2">

          {/* Row 1: Logo + Seguradora + Tipo */}
          <div className="grid grid-cols-6 gap-x-2 gap-y-5">
            {/* Logo inline ao lado do select, nao numa coluna propria: como
                coluna ele deslocava a linha 1 em relacao as de baixo. */}
            <div className="col-span-4 min-w-0">
              <label className={LABEL}>Seguradora</label>
              <div className="flex items-center gap-2">
                <InsurerLogo insurer={selectedInsurer} compact />
                <Controller
                  name="insurer"
                  control={control}
                  render={({ field }) => (
                    <NativeSelect
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    >
                      <option value="">Selecione...</option>
                      {insurers.map((ins) => (
                        <option key={ins.id} value={ins.id}>{ins.display_name}</option>
                      ))}
                    </NativeSelect>
                  )}
                />
              </div>
              {errors.insurer && <p className="mt-0.5 text-xs text-error-400">{errors.insurer.message}</p>}
            </div>

            <div className="col-span-2">
              <label className={LABEL}>Tipo</label>
              <Controller
                name="insured_type"
                control={control}
                render={({ field }) => (
                  <NativeSelect {...field} value={field.value ?? ""}>
                    <option value="">Selecionar...</option>
                    <option value="insured">Segurado</option>
                    <option value="third">Terceiro</option>
                  </NativeSelect>
                )}
              />
            </div>
          </div>

          {/* Row 2: Sinistro + Corretor + Franquia */}
          <div className="grid grid-cols-6 gap-x-2 gap-y-5">
            <div className="col-span-3 sm:col-span-2">
              <label className={LABEL}>Sinistro</label>
              <input className={INPUT} type="text" placeholder="Ex: 2024/001234" {...register("casualty_number")} aria-invalid={!!errors.casualty_number} />
            </div>
            <div className="col-span-3 sm:col-span-2">
              <label className={LABEL}>Corretor</label>
              <input className={INPUT} type="text" placeholder="Nome do corretor" {...register("broker_name")} aria-invalid={!!errors.broker_name} />
            </div>
            {insuredType === "insured" && (
              <div className="col-span-3 sm:col-span-2">
                <label className={LABEL}>Franquia (R$)</label>
                <input
                  className={INPUT}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register("deductible_amount", { valueAsNumber: true })} aria-invalid={!!errors.deductible_amount}
                />
              </div>
            )}
          </div>

          {/* Row 3: Perito + Visita */}
          <div className="grid grid-cols-6 gap-x-2 gap-y-5">
            <div className="col-span-6 sm:col-span-4">
              <label className={LABEL}>Perito</label>
              <Controller
                name="expert"
                control={control}
                render={({ field }) => (
                  <ExpertCombobox
                    value={field.value ?? null}
                    onChange={(id) => field.onChange(id)}
                    insurerId={insurerId}
                    knownExpert={order?.expert_detail ?? null}
                  />
                )}
              />
            </div>
            <div className="col-span-3 sm:col-span-2">
              <label className={LABEL}>Visita perito</label>
              <Controller
                name="expert_date"
                control={control}
                render={({ field }) => (
                  <DateField
                    value={field.value}
                    onChange={field.onChange}
                    aria-invalid={!!errors.expert_date}
                  />
                )}
              />
            </div>
          </div>

          {/* Row 4: Datas */}
          <div className="grid grid-cols-6 gap-x-2 gap-y-5">
            <div className="col-span-3 sm:col-span-2">
              <label className={LABEL}>Vistoria</label>
              <Controller
                name="survey_date"
                control={control}
                render={({ field }) => (
                  <DateField
                    value={field.value}
                    onChange={field.onChange}
                    aria-invalid={!!errors.survey_date}
                  />
                )}
              />
            </div>
            <div className="col-span-3 sm:col-span-4">
              <label className={LABEL}>Autorização</label>
              <Controller
                name="authorization_date"
                control={control}
                render={({ field }) => (
                  <DateField
                    withTime
                    value={field.value}
                    onChange={field.onChange}
                    aria-invalid={!!errors.authorization_date}
                    className={errors.authorization_date ? "!border-error-500" : undefined}
                  />
                )}
              />
              {errors.authorization_date
                ? <p className="mt-0.5 text-xs text-error-400">{errors.authorization_date.message}</p>
                : <p className="mt-0.5 text-xs text-amber-600 font-medium">Preencher muda status</p>
              }
            </div>
          </div>

      </div>
    </div>
  )
}
