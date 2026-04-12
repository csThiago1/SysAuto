"use client"

import { type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { TypeBar } from "../sections/TypeBar"
import { InsurerSection } from "../sections/InsurerSection"
import { CustomerSection } from "../sections/CustomerSection"
import { VehicleSection } from "../sections/VehicleSection"
import { EntrySection } from "../sections/EntrySection"
import { PrazosSection } from "../sections/PrazosSection"

interface OpeningTabProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function OpeningTab({ form }: OpeningTabProps) {
  const customerType = form.watch("customer_type") ?? "private"

  return (
    <div className="space-y-3 py-4">
      {/* Barra tipo — full width */}
      <TypeBar form={form} customerType={customerType} />

      {/* Duas colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coluna esquerda */}
        <div className="space-y-3">
          <CustomerSection form={form} />
          {customerType === "insurer" && <InsurerSection form={form} />}
          <EntrySection form={form} />
        </div>
        {/* Coluna direita */}
        <div className="space-y-3">
          <VehicleSection form={form} />
          <PrazosSection form={form} />
        </div>
      </div>
    </div>
  )
}
