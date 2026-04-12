"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { CustomerSearch } from "../shared/CustomerSearch"
import { useCustomerDetail } from "../../_hooks/useCustomerSearch"

const SECTION_TITLE = "text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
const LABEL = "block text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT_DISPLAY =
  "flex h-8 w-full rounded-md border border-neutral-100 bg-neutral-50 px-2.5 py-1 text-sm text-neutral-600 cursor-default select-all"

interface CustomerSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function CustomerSection({ form }: CustomerSectionProps) {
  const { control, setValue, watch } = form
  const customerId = watch("customer")

  const { data: detail } = useCustomerDetail(customerId ?? null)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={SECTION_TITLE}>Dados do Cliente</span>
      </div>

      {/* Busca / chip */}
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
              setValue("customer_name", customer?.name ?? "")
            }}
          />
        )}
      />

      {/* Campos do cliente — visíveis apenas quando selecionado */}
      {customerId && detail && (
        <>
          {/* Linha 1: CPF | Telefone | Nascimento | Email */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className={LABEL}>CPF</label>
              <input className={INPUT_DISPLAY} readOnly value={detail.cpf_masked ?? ""} placeholder="—" />
            </div>
            <div>
              <label className={LABEL}>Telefone</label>
              <input className={INPUT_DISPLAY} readOnly value={detail.phone_masked ?? ""} placeholder="—" />
            </div>
            <div>
              <label className={LABEL}>Nascimento</label>
              <input
                className={INPUT_DISPLAY}
                readOnly
                value={
                  detail.birth_date
                    ? new Date(detail.birth_date + "T00:00:00").toLocaleDateString("pt-BR")
                    : ""
                }
                placeholder="—"
              />
            </div>
            <div>
              <label className={LABEL}>E-mail</label>
              <input className={INPUT_DISPLAY} readOnly value={detail.email ?? ""} placeholder="—" />
            </div>
          </div>

          {/* Endereço — 7 campos */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-[72px_1fr_52px] gap-2">
              <div>
                <label className={LABEL}>CEP</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.zip_code || "—"} />
              </div>
              <div>
                <label className={LABEL}>Rua / Av.</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.street || "—"} />
              </div>
              <div>
                <label className={LABEL}>Nº</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.street_number || "—"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>Complemento</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.complement || "—"} />
              </div>
              <div>
                <label className={LABEL}>Bairro</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.neighborhood || "—"} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_44px] gap-2">
              <div>
                <label className={LABEL}>Cidade</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.city || "—"} />
              </div>
              <div>
                <label className={LABEL}>UF</label>
                <input className={INPUT_DISPLAY} readOnly value={detail.state || "—"} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
