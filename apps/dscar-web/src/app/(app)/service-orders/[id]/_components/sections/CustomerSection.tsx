"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { CustomerSearch } from "../shared/CustomerSearch"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"
const INPUT = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface CustomerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function CustomerSection({ form }: CustomerSectionProps) {
  const { register, control, setValue, formState: { errors } } = form

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-2">
        <span className={SECTION_TITLE}>Dados do Cliente</span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Busca de cliente */}
        <div>
          <label className={LABEL}>Buscar cliente por CPF, nome ou telefone *</label>
          <Controller
            name="customer"
            control={control}
            render={({ field }) => (
              <CustomerSearch
                value={
                  field.value
                    ? { id: field.value, name: form.watch("customer_name") ?? "" }
                    : null
                }
                onChange={(customer) => {
                  field.onChange(customer?.id ?? null)
                  if (customer) setValue("customer_name", customer.name)
                }}
              />
            )}
          />
        </div>

        {/* Nome (desnormalizado) */}
        <div>
          <label className={LABEL}>Nome do cliente *</label>
          <input
            className={INPUT}
            type="text"
            placeholder="Nome completo"
            {...register("customer_name")}
          />
          {errors.customer_name && (
            <p className="mt-1 text-xs text-red-600">{errors.customer_name.message}</p>
          )}
        </div>
      </div>
    </div>
  )
}
