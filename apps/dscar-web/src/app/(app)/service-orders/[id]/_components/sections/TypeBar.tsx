"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { Loader2 } from "lucide-react"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { useConsultants } from "../../_hooks/useStaff"

const LABEL = "block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-0.5"
const SELECT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface TypeBarProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  customerType: "insurer" | "private"
}

const OS_TYPES = [
  { value: "bodywork", label: "Chapeação" },
  { value: "warranty", label: "Garantia" },
  { value: "rework", label: "Retrabalho" },
  { value: "mechanical", label: "Mecânica" },
  { value: "aesthetic", label: "Estética" },
] as const

export function TypeBar({ form, customerType }: TypeBarProps) {
  const { register, control } = form
  const { data: consultants = [], isLoading: loadingConsultants } = useConsultants()

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">

      {/* Pill toggle Particular / Seguradora */}
      <div>
        <label className={LABEL}>Atendimento *</label>
        <Controller
          name="customer_type"
          control={control}
          render={({ field }) => (
            <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
              {(["private", "insurer"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => field.onChange(type)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    field.value === type
                      ? "bg-primary text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground/70"
                  }`}
                >
                  {type === "private" ? "Particular" : "Seguradora"}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Tipo OS */}
      <div className="min-w-[140px]">
        <label className={LABEL}>Tipo OS</label>
        <select className={SELECT} {...register("os_type")}>
          <option value="">Selecionar...</option>
          {OS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Consultor */}
      <div className="min-w-[180px]">
        <label className={LABEL}>
          Consultor
          {loadingConsultants && (
            <Loader2 className="inline ml-1 h-2.5 w-2.5 animate-spin text-muted-foreground" />
          )}
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
              <option value="">Selecionar...</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.job_title_display ? ` (${c.job_title_display})` : ""}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Data orçamento — só quando Particular */}
      {customerType === "private" && (
        <div>
          <label className={LABEL}>Data orçamento</label>
          <input
            className={`${SELECT} w-[140px]`}
            type="date"
            {...register("quotation_date")}
          />
        </div>
      )}
    </div>
  )
}
