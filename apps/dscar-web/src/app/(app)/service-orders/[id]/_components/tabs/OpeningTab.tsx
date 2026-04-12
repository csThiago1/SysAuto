"use client"

import { type UseFormReturn } from "react-hook-form"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { OpeningInfoSection } from "../sections/OpeningInfoSection"
import { InsurerSection } from "../sections/InsurerSection"
import { PrivateSection } from "../sections/PrivateSection"
import { CustomerSection } from "../sections/CustomerSection"
import { VehicleSection } from "../sections/VehicleSection"
import { EntrySection } from "../sections/EntrySection"
import { SchedulingSection } from "../sections/SchedulingSection"
import { FinalSurveySection } from "../sections/FinalSurveySection"

interface OpeningTabProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  /** Nome do consultor salvo na OS — repassado para exibição de fallback */
  consultantName?: string
}

export function OpeningTab({ form, consultantName }: OpeningTabProps) {
  const customerType = form.watch("customer_type")

  return (
    <div className="space-y-6 py-4">
      <OpeningInfoSection form={form} consultantName={consultantName} />
      {customerType === "insurer" && <InsurerSection form={form} />}
      {customerType === "private" && <PrivateSection form={form} />}
      <CustomerSection form={form} />
      <VehicleSection form={form} />
      <EntrySection form={form} />
      <SchedulingSection form={form} />
      <FinalSurveySection form={form} />
    </div>
  )
}
