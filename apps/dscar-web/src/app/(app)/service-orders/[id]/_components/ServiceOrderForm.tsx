"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"
import { VALID_TRANSITIONS } from "@paddock/types"
import { SERVICE_ORDER_STATUS_CONFIG } from "@paddock/utils"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ArrowRight, Loader2, ChevronDown, Save } from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"

import { serviceOrderUpdateSchema, type ServiceOrderUpdateInput } from "../_schemas/service-order.schema"
import { buildFormDefaults, FIELD_LABELS } from "../_utils/form-defaults"
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
import { ImportBudgetModal } from "./ImportBudgetModal"

type TabId = "opening" | "parts" | "services" | "notes" | "reminders" | "history" | "closing" | "estoque" | "files"

interface ServiceOrderFormProps {
  order: ServiceOrder
}

export function ServiceOrderForm({ order }: ServiceOrderFormProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>("opening")
  const [personDirtyData, setPersonDirtyData] = useState<PersonPatch | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)

  const TABS: { id: TabId; label: string }[] = [
    { id: "opening", label: "Abertura" },
    { id: "parts", label: "Peças" },
    { id: "services", label: "Serviços" },
    { id: "notes", label: "Observações" },
    { id: "reminders", label: "Lembretes" },
    { id: "history", label: "Histórico" },
    { id: "closing", label: "Fechamento" },
    { id: "estoque", label: "Estoque" },
    { id: "files", label: "Arquivos" },
  ]

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

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  const handleBack = useCallback(() => {
    if (isDirty) {
      if (window.confirm("Existem alterações não salvas. Deseja sair mesmo assim?")) {
        router.back()
      }
    } else {
      router.back()
    }
  }, [isDirty, router])

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
      {/* Breadcrumb */}
      <div className="px-6 pt-4 pb-0">
        <Breadcrumb
          items={[
            { label: "Ordens de Serviço", href: "/service-orders" },
            { label: `OS #${order.number}` },
          ]}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/50 px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-foreground">OS #{order.number}</h1>
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50 transition-colors"
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
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-info-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-info-700"
          >
            ⬇ Importar Orçamento
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-muted/30"
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
                ? "bg-primary text-foreground shadow-md hover:bg-primary/90"
                : "cursor-not-allowed bg-muted text-muted-foreground",
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
      <div className="border-b bg-muted/50">
        <nav className="flex overflow-x-auto px-6" aria-label="Abas da OS">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabId)}
              className={cn(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/60 hover:border-border hover:text-foreground/90"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 overflow-y-auto bg-muted/30 px-6">
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

      {/* Import Budget Modal */}
      <ImportBudgetModal
        order={order}
        open={importModalOpen}
        onClose={() => {
          setImportModalOpen(false)
          router.refresh()
        }}
      />

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
