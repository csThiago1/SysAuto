"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import type { ServiceOrder } from "@paddock/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

import { serviceOrderUpdateSchema, type ServiceOrderUpdateInput } from "../_schemas/service-order.schema"
import { useServiceOrderUpdate } from "../_hooks/useServiceOrder"
import { useAutoTransition } from "../_hooks/useAutoTransition"
import { StatusBadge } from "./shared/StatusBadge"
import { ClosingTab } from "./tabs/ClosingTab"
import { FilesTab } from "./tabs/FilesTab"
import { HistoryTab } from "./tabs/HistoryTab"
import { NotesTab } from "./tabs/NotesTab"
import { OpeningTab } from "./tabs/OpeningTab"
import { PartsTab } from "./tabs/PartsTab"
import { RemindersTab } from "./tabs/RemindersTab"
import { ServicesTab } from "./tabs/ServicesTab"

const TABS = [
  { id: "opening", label: "Abertura" },
  { id: "parts", label: "Peças" },
  { id: "services", label: "Serviços" },
  { id: "notes", label: "Observações" },
  { id: "reminders", label: "Lembretes" },
  { id: "history", label: "Histórico" },
  { id: "closing", label: "Fechamento" },
  { id: "files", label: "Arquivos" },
] as const

type TabId = (typeof TABS)[number]["id"]

interface ServiceOrderFormProps {
  order: ServiceOrder
}

export function ServiceOrderForm({ order }: ServiceOrderFormProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>("opening")

  const form = useForm<ServiceOrderUpdateInput>({
    resolver: zodResolver(serviceOrderUpdateSchema),
    defaultValues: {
      consultant_id: order.consultant ?? undefined,
      customer_type: order.customer_type ?? undefined,
      os_type: order.os_type ?? undefined,
      insurer: order.insurer ?? undefined,
      insured_type: order.insured_type ?? undefined,
      casualty_number: order.casualty_number ?? "",
      deductible_amount: order.deductible_amount ? parseFloat(order.deductible_amount) : undefined,
      broker_name: order.broker_name ?? "",
      expert: order.expert ?? undefined,
      expert_date: order.expert_date ?? undefined,
      survey_date: order.survey_date ?? undefined,
      authorization_date: order.authorization_date ?? undefined,
      quotation_date: order.quotation_date ?? undefined,
      customer: order.customer ?? undefined,
      customer_name: order.customer_name ?? "",
      plate: order.plate ?? "",
      make: order.make ?? "",
      model: order.model ?? "",
      year: order.year ?? undefined,
      color: order.color ?? "",
      chassis: order.chassis ?? "",
      fuel_type: order.fuel_type ?? "",
      fipe_value: order.fipe_value ? parseFloat(order.fipe_value) : undefined,
      mileage_in: order.mileage_in ?? undefined,
      vehicle_location: order.vehicle_location ?? "workshop",
      entry_date: order.entry_date ?? undefined,
      service_authorization_date: order.service_authorization_date ?? undefined,
      scheduling_date: order.scheduling_date ?? undefined,
      repair_days: order.repair_days ?? undefined,
      estimated_delivery_date: order.estimated_delivery_date ?? undefined,
      delivery_date: order.delivery_date ?? undefined,
      final_survey_date: order.final_survey_date ?? undefined,
      client_delivery_date: order.client_delivery_date ?? undefined,
    },
  })

  const updateMutation = useServiceOrderUpdate(order.id)
  useAutoTransition({ order })

  const isPending = updateMutation.isPending

  async function onSubmit(data: ServiceOrderUpdateInput) {
    await updateMutation.mutateAsync(data)
    toast.success("OS salva!")
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">OS #{order.number}</h1>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={form.handleSubmit(onSubmit)}
            className="rounded-md bg-[#ea0e03] px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white">
        <nav className="flex overflow-x-auto px-6" aria-label="Abas da OS">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-[#ea0e03] text-[#ea0e03]"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {activeTab === "opening" && <OpeningTab form={form} />}
          {activeTab === "parts" && <PartsTab orderId={order.id} />}
          {activeTab === "services" && <ServicesTab orderId={order.id} />}
          {activeTab === "notes" && <NotesTab orderId={order.id} initialNotes={order.notes} />}
          {activeTab === "reminders" && <RemindersTab orderId={order.id} />}
          {activeTab === "history" && <HistoryTab order={order} />}
          {activeTab === "closing" && <ClosingTab order={order} />}
          {activeTab === "files" && <FilesTab order={order} />}
        </form>
      </div>

      {/* Erros de validação */}
      {Object.keys(form.formState.errors).length > 0 && (
        <div className="border-t bg-red-50 px-6 py-3">
          <p className="text-xs font-medium text-red-700 mb-1">Corrija os erros antes de salvar:</p>
          <ul className="space-y-0.5">
            {Object.entries(form.formState.errors).map(([field, err]) => (
              <li key={field} className="text-xs text-red-600">• {err?.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
