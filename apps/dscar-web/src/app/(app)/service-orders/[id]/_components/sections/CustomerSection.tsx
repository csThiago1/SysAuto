"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { CustomerSearch } from "../shared/CustomerSearch"
import { useCustomerDetail } from "../../_hooks/useCustomerSearch"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT = "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
const INPUT_DISPLAY = "flex h-8 w-full rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-sm text-neutral-600 cursor-default select-all"

interface CustomerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function CustomerSection({ form }: CustomerSectionProps) {
  const { register, control, setValue, watch, formState: { errors } } = form
  const customerId = watch("customer")
  const customerType = watch("customer_type")

  // Busca detalhes do cliente selecionado (email, nasc., endereço)
  const { data: detail } = useCustomerDetail(customerId ?? null)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={SECTION_TITLE}>Dados do Cliente</span>
      </div>

      {/* Busca — sempre visível */}
      <Controller
        name="customer"
        control={control}
        render={({ field }) => (
          <CustomerSearch
            value={
              field.value
                ? {
                    id: field.value,
                    name: watch("customer_name") ?? "",
                    phone_masked: detail?.phone_masked ?? null,
                    cpf_masked: detail?.cpf_masked ?? null,
                  }
                : null
            }
            onChange={(customer) => {
              field.onChange(customer?.id ?? null)
              if (customer) setValue("customer_name", customer.name)
            }}
          />
        )}
      />

      {/* Linha 1: Nome | CPF | Telefone | Nasc. */}
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className={LABEL}>Nome na OS</label>
          <input
            className={INPUT}
            type="text"
            placeholder="Nome do cliente"
            {...register("customer_name")}
          />
          {errors.customer_name && (
            <p className="mt-0.5 text-[10px] text-red-600">{errors.customer_name.message}</p>
          )}
        </div>

        <div>
          <label className={LABEL}>CPF</label>
          <input
            className={INPUT_DISPLAY}
            readOnly
            value={detail?.cpf_masked ?? ""}
            placeholder="—"
          />
        </div>

        <div>
          <label className={LABEL}>Telefone</label>
          <input
            className={INPUT_DISPLAY}
            readOnly
            value={detail?.phone_masked ?? ""}
            placeholder="—"
          />
        </div>
      </div>

      {/* Linha 2: Email | Nasc. | Endereço */}
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-2">
          <label className={LABEL}>E-mail</label>
          <input
            className={INPUT_DISPLAY}
            readOnly
            value={detail?.email ?? ""}
            placeholder="—"
          />
        </div>

        <div>
          <label className={LABEL}>Nascimento</label>
          <input
            className={INPUT_DISPLAY}
            readOnly
            type="text"
            value={
              detail?.birth_date
                ? new Date(detail.birth_date + "T00:00:00").toLocaleDateString("pt-BR")
                : ""
            }
            placeholder="—"
          />
        </div>

        <div>
          {customerType === "private" && (
            <>
              <label className={LABEL}>Orçamento</label>
              <input className={INPUT} type="date" {...register("quotation_date")} />
            </>
          )}
        </div>
      </div>

      {/* Linha 3: Endereço — full width */}
      <div>
        <label className={LABEL}>Endereço</label>
        <input
          className={INPUT_DISPLAY}
          readOnly
          value={
            detail
              ? [
                  detail.street,
                  detail.street_number,
                  detail.complement,
                  detail.neighborhood,
                  detail.city && detail.state
                    ? `${detail.city} / ${detail.state}`
                    : detail.city || detail.state,
                  detail.zip_code,
                ]
                  .filter(Boolean)
                  .join(", ")
              : ""
          }
          placeholder="—"
        />
      </div>
    </div>
  )
}
