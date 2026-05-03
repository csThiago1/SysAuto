"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"
import { VALID_TRANSITIONS } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ArrowRight, Loader2, ChevronDown, Save } from "lucide-react"

import { serviceOrderUpdateSchema, type ServiceOrderUpdateInput } from "../_schemas/service-order.schema"
import { useServiceOrderUpdate } from "../_hooks/useServiceOrder"
import { useAutoTransition } from "../_hooks/useAutoTransition"
import { usePersonUpdate, type PersonPatch } from "../_hooks/useCustomerSearch"
import { useTransitionStatus } from "@/hooks/useServiceOrders"
import { StatusBadge } from "./shared/StatusBadge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { DocumentsDropdown } from "./DocumentsDropdown"
import { ClosingTab } from "./tabs/ClosingTab"
import { FilesTab } from "./tabs/FilesTab"
import { HistoryTab } from "./tabs/HistoryTab"
import { NotesTab } from "./tabs/NotesTab"
import { OpeningTab } from "./tabs/OpeningTab"
import { PartsTab } from "./tabs/PartsTab"
import { RemindersTab } from "./tabs/RemindersTab"
import { ServicesTab } from "./tabs/ServicesTab"
import { EstoqueTab } from "@/components/os/EstoqueTab"

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
  { id: "estoque", label: "Estoque" },
  { id: "files", label: "Arquivos" },
] as const

type TabId = (typeof TABS)[number]["id"]

interface ServiceOrderFormProps {
  order: ServiceOrder
}

/** Converte ServiceOrder do backend em defaultValues do form — única fonte de verdade. */
function buildFormDefaults(o: ServiceOrder): ServiceOrderUpdateInput {
  return {
    consultant_id: o.consultant ?? undefined,
    customer_type: o.customer_type ?? undefined,
    os_type: o.os_type ?? undefined,
    insurer: o.insurer ?? undefined,
    insured_type: o.insured_type ?? undefined,
    casualty_number: o.casualty_number ?? "",
    deductible_amount: o.deductible_amount ? parseFloat(o.deductible_amount) : undefined,
    broker_name: o.broker_name ?? "",
    expert: o.expert ?? undefined,
    expert_date: o.expert_date ?? undefined,
    survey_date: o.survey_date ?? undefined,
    authorization_date: o.authorization_date ?? undefined,
    quotation_date: o.quotation_date ?? undefined,
    customer: o.customer_uuid ?? undefined,
    customer_person_id: o.customer_person_id ?? undefined,
    customer_name: o.customer_name ?? "",
    plate: o.plate ?? "",
    make: o.make ?? "",
    make_logo: o.make_logo ?? "",
    model: o.model ?? "",
    vehicle_version: o.vehicle_version ?? "",
    year: o.year ?? undefined,
    color: o.color ?? "",
    chassis: o.chassis ?? "",
    fuel_type: o.fuel_type ?? "",
    fipe_value: o.fipe_value ? parseFloat(o.fipe_value) : undefined,
    mileage_in: o.mileage_in ?? undefined,
    vehicle_location: o.vehicle_location ?? "workshop",
    entry_date: o.entry_date ?? undefined,
    service_authorization_date: o.service_authorization_date ?? undefined,
    scheduling_date: o.scheduling_date ?? undefined,
    repair_days: o.repair_days ?? undefined,
    estimated_delivery_date: o.estimated_delivery_date ?? undefined,
    delivery_date: o.delivery_date ?? undefined,
    final_survey_date: o.final_survey_date ?? undefined,
    client_delivery_date: o.client_delivery_date ?? undefined,
  }
}

export function ServiceOrderForm({ order }: ServiceOrderFormProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>("opening")
  const [personDirtyData, setPersonDirtyData] = useState<PersonPatch | null>(null)

  const form = useForm<ServiceOrderUpdateInput>({
    resolver: zodResolver(serviceOrderUpdateSchema),
    defaultValues: buildFormDefaults(order),
  })

  const { dirtyFields } = form.formState
  // isDirty do RHF fica true por causa de z.preprocess no zodResolver
  // que transforma valores (undefined→null) mesmo sem interação do usuário.
  // Usar contagem real de dirtyFields como fonte de verdade.
  const isDirty = Object.keys(dirtyFields).length > 0

  // Transições de reparo são gerenciadas exclusivamente pelo mobile
  const REPAIR_PHASE_STATUSES: ServiceOrderStatus[] = [
    "repair", "mechanic", "bodywork", "painting", "assembly",
    "polishing", "washing", "final_survey", "ready",
  ]
  const isRepairPhase = REPAIR_PHASE_STATUSES.includes(order.status as ServiceOrderStatus)

  const updateMutation = useServiceOrderUpdate(order.id)
  const personUpdateMutation = usePersonUpdate(order.customer_person_id ?? null)
  const transitionMutation = useTransitionStatus(order.id)
  useAutoTransition({ order })

  const isPending = updateMutation.isPending || personUpdateMutation.isPending
  const nextStatuses = isRepairPhase
    ? []
    : (VALID_TRANSITIONS[order.status as ServiceOrderStatus] ?? [])

  async function handleTransition(newStatus: ServiceOrderStatus) {
    try {
      await transitionMutation.mutateAsync(newStatus)
      toast.success(`Status atualizado para "${SERVICE_ORDER_STATUS_CONFIG[newStatus].label}"`)
      router.refresh()
    } catch {
      toast.error("Erro ao atualizar status. Tente novamente.")
    }
  }

  async function onSubmit(data: ServiceOrderUpdateInput) {
    try {
      const savedOrder = await updateMutation.mutateAsync(data)
      // Reset form to saved values so isDirty becomes false
      form.reset(buildFormDefaults(savedOrder))
      if (personDirtyData && order.customer_person_id) {
        await personUpdateMutation.mutateAsync(personDirtyData)
        setPersonDirtyData(null)
      }
      toast.success("OS salva com sucesso!")
      router.refresh()
    } catch {
      toast.error("Erro ao salvar OS. Tente novamente.")
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white/5 px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">OS #{order.number}</h1>
          <StatusBadge status={order.status as ServiceOrderStatus} />
        </div>
        <div className="flex items-center gap-3">
          <DocumentsDropdown order={order} />

          {/* Status transition dropdown — hidden for terminal statuses */}
          {nextStatuses.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={transitionMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary-600 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-500/5 disabled:opacity-50 transition-colors"
                >
                  {transitionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  Avançar Status
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Próximos status permitidos</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {nextStatuses.map((nextStatus) => {
                  const cfg = SERVICE_ORDER_STATUS_CONFIG[nextStatus]
                  return (
                    <DropdownMenuItem
                      key={nextStatus}
                      onClick={() => void handleTransition(nextStatus)}
                      disabled={transitionMutation.isPending}
                    >
                      <span className={cn("mr-2 h-2 w-2 rounded-full shrink-0", cfg.dot)} />
                      {cfg.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isDirty && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              Alterações não salvas
            </span>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.03]"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={isPending || !isDirty}
            onClick={form.handleSubmit(onSubmit)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all",
              isDirty
                ? "bg-primary-600 text-white shadow-md hover:bg-primary-700"
                : "cursor-not-allowed bg-white/10 text-white/40",
              isPending && "opacity-50"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white/5">
        <nav className="flex overflow-x-auto px-6" aria-label="Abas da OS">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-white/60 hover:border-white/15 hover:text-white/90"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 overflow-y-auto bg-white/[0.03] px-6">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {activeTab === "opening" && (
            <OpeningTab form={form} order={order} onPersonDataChange={setPersonDirtyData} />
          )}
          {activeTab === "parts" && <PartsTab orderId={order.id} />}
          {activeTab === "services" && <ServicesTab osId={order.id} osStatus={order.status as ServiceOrderStatus} />}
          {activeTab === "notes" && <NotesTab orderId={order.id} initialNotes={order.notes} />}
          {activeTab === "reminders" && <RemindersTab orderId={order.id} />}
          {activeTab === "history" && <HistoryTab order={order} />}
          {activeTab === "closing" && <ClosingTab order={order} />}
          {activeTab === "estoque" && <EstoqueTab osId={order.id} />}
          {activeTab === "files" && <FilesTab order={order} />}
        </form>
      </div>

      {/* Erros de validação */}
      {Object.keys(form.formState.errors).length > 0 && (
        <div className="border-t bg-error-500/10 px-6 py-3">
          <p className="text-xs font-semibold text-error-400 mb-1">
            Corrija os erros abaixo antes de salvar:
          </p>
          <ul className="space-y-0.5">
            {Object.entries(form.formState.errors).map(([field, err]) => (
              <li key={field} className="text-xs text-error-400">
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
