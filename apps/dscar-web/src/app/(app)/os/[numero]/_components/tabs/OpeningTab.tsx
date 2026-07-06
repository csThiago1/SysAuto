"use client"

import { useWatch, type UseFormReturn } from "react-hook-form"
import type { ServiceOrder } from "@paddock/types"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import type { PersonPatch } from "../../_hooks/useCustomerSearch"
import { TypeBar } from "../sections/TypeBar"
import { InsurerSection } from "../sections/InsurerSection"
import { CustomerSection } from "../sections/CustomerSection"
import { VehicleSection } from "../sections/VehicleSection"
import { EntrySection } from "../sections/EntrySection"
import { PrazosSection } from "../sections/PrazosSection"

interface OpeningTabProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  order?: Pick<ServiceOrder, "id" | "nfe_key" | "nfse_number" | "invoice_issued">
  onPersonDataChange?: (data: PersonPatch | null) => void
}

/** Painel de grupo do form — mesma linguagem dos cards da Visão Geral. */
function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      {children}
    </div>
  )
}

export function OpeningTab({ form, order, onPersonDataChange }: OpeningTabProps) {
  const customerType = useWatch({ control: form.control, name: "customer_type" }) ?? "private"

  return (
    <div className="space-y-4 py-4">
      {/* Barra tipo — full width */}
      <FormCard>
        <TypeBar form={form} customerType={customerType} />
      </FormCard>

      {/* Duas colunas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
        {/* Coluna esquerda */}
        <div className="space-y-4">
          <FormCard>
            <CustomerSection form={form} onPersonDataChange={onPersonDataChange} />
          </FormCard>
          {customerType === "insurer" && (
            <FormCard>
              <InsurerSection form={form} />
            </FormCard>
          )}
          <FormCard>
            <EntrySection form={form} order={order} />
          </FormCard>
        </div>
        {/* Coluna direita */}
        <div className="space-y-4">
          <FormCard>
            <VehicleSection form={form} osId={order?.id} />
          </FormCard>
          <FormCard>
            <PrazosSection form={form} />
          </FormCard>
        </div>
      </div>
    </div>
  )
}
