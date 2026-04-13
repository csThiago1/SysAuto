"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"

import { serviceOrderUpdateSchema, type ServiceOrderUpdateInput } from "../_schemas/service-order.schema"
import { useServiceOrderUpdate } from "../_hooks/useServiceOrder"
import { useAutoTransition } from "../_hooks/useAutoTransition"
import { useCustomerUpdate, type CustomerUpdateInput } from "../_hooks/useCustomerSearch"
import { StatusBadge } from "./shared/StatusBadge"
import { ClosingTab } from "./tabs/ClosingTab"
import { FilesTab } from "./tabs/FilesTab"
import { HistoryTab } from "./tabs/HistoryTab"
import { NotesTab } from "./tabs/NotesTab"
import { OpeningTab } from "./tabs/OpeningTab"
import { PartsTab } from "./tabs/PartsTab"
import { RemindersTab } from "./tabs/RemindersTab"
import { ServicesTab } from "./tabs/ServicesTab"

const FIELD_LABELS: Record<string, string> = {
  customer_name: "Nome do cliente",
  plate: "Placa",
  year: "Ano do veículo",
  mileage_in: "KM de entrada",
  entry_date: "Data/hora de entrada",
  service_authorization_date: "Autorização do serviço",
  scheduling_date: "Agendamento",
  authorization_date: "Data de autorização",
  delivery_date: "Data real de entrega",
  final_survey_date: "Vistoria final",
  client_delivery_date: "Entrega ao cliente",
  expert_date: "Visita do perito",
  survey_date: "Data da vistoria",
  quotation_date: "Data do orçamento",
  estimated_delivery_date: "Previsão de entrega",
  repair_days: "Dias de reparo",
  insurer: "Seguradora",
  insured_type: "Tipo de segurado",
  deductible_amount: "Franquia",
  fipe_value: "Valor FIPE",
  chassis: "Chassi",
}

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
  const [customerDirtyData, setCustomerDirtyData] = useState<CustomerUpdateInput | null>(null)

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
      quotation_date: order.quotation_date ?? new Date().toISOString().split("T")[0],
      customer: order.customer_uuid ?? undefined,   // UUID do UnifiedCustomer para lookup de detalhes
      customer_name: order.customer_name ?? "",
      plate: order.plate ?? "",
      make: order.make ?? "",
      model: order.model ?? "",
      vehicle_version: order.vehicle_version ?? "",
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
  const customerUpdateMutation = useCustomerUpdate(
    form.watch("customer") ?? order.customer_uuid ?? null
  )
  useAutoTransition({ order })

  const isPending = updateMutation.isPending || customerUpdateMutation.isPending

  async function onSubmit(data: ServiceOrderUpdateInput) {
    await updateMutation.mutateAsync(data)
    const customerId = data.customer ?? order.customer_uuid
    if (customerDirtyData && customerId) {
      await customerUpdateMutation.mutateAsync(customerDirtyData)
      setCustomerDirtyData(null)
      // Log customer changes in OS history
      const CUSTOMER_FIELD_LABELS: Record<string, string> = {
        name: "Nome", phone: "Telefone", email: "E-mail",
        birth_date: "Nascimento", zip_code: "CEP", street: "Rua",
        street_number: "Número", complement: "Complemento",
        neighborhood: "Bairro", city: "Cidade", state: "UF",
      }
      const fieldChanges = Object.entries(customerDirtyData).map(([k, v]) => ({
        field: k,
        field_label: CUSTOMER_FIELD_LABELS[k] ?? k,
        old_value: null,
        new_value: String(v ?? ""),
      }))
      await apiFetch(`/api/proxy/service-orders/${order.id}/history/`, {
        method: "POST",
        body: JSON.stringify({
          activity_type: "customer_updated",
          message: "Dados do cliente atualizados.",
          metadata: { field_changes: fieldChanges },
        }),
      }).catch(() => {/* non-critical, don't block the save */})
    }
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
                  : "border-transparent text-neutral-600 hover:border-gray-300 hover:text-neutral-800"
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
          {activeTab === "opening" && (
            <OpeningTab form={form} onCustomerDataChange={setCustomerDirtyData} />
          )}
          {activeTab === "parts" && <PartsTab orderId={order.id} />}
          {activeTab === "services" && <ServicesTab osId={order.id} osStatus={order.status as ServiceOrderStatus} />}
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
          <p className="text-xs font-semibold text-red-700 mb-1">
            Corrija os erros abaixo antes de salvar:
          </p>
          <ul className="space-y-0.5">
            {Object.entries(form.formState.errors).map(([field, err]) => (
              <li key={field} className="text-xs text-red-600">
                • <span className="font-medium">{FIELD_LABELS[field] ?? field}:</span>{" "}
                {err?.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
