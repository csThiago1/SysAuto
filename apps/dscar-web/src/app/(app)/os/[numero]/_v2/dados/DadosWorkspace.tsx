"use client"

/**
 * Dados da OS — tela refeita.
 *
 * Fluxo vertical em painéis com hierarquia clara:
 *   Atendimento → Cliente → Veículo → Linha do tempo → Planejamento.
 * Datas viraram MilestoneTimeline (linha do tempo interativa) no lugar
 * da parede de inputs datetime. Busca de cliente e FIPE do veículo são
 * os widgets pesados reusados da v1.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  CalendarClock,
  Car,
  ClipboardList,
  Loader2,
  Milestone as MilestoneIcon,
  Save,
  Shield,
  User,
} from "lucide-react"
import { toast } from "sonner"
import type { ServiceOrder } from "@paddock/types"
import { FORM_INPUT, FORM_LABEL } from "@paddock/utils"
import { ApiError } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { cn } from "@/lib/utils"
import { serviceOrderUpdateSchema, type ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { buildFormDefaults } from "../../_utils/form-defaults"
import { useServiceOrderUpdate } from "../../_hooks/useServiceOrder"
import { usePersonUpdate, type PersonPatch } from "../../_hooks/useCustomerSearch"
import { useConsultants } from "../../_hooks/useStaff"
import { CustomerSection } from "../../_components/sections/CustomerSection"
import { InsurerSection } from "../../_components/sections/InsurerSection"
import { VehicleSection } from "../../_components/sections/VehicleSection"
import { MilestoneTimeline } from "./MilestoneTimeline"

const OS_TYPES = [
  { value: "bodywork", label: "Chapeação" },
  { value: "warranty", label: "Garantia" },
  { value: "rework", label: "Retrabalho" },
  { value: "mechanical", label: "Mecânica" },
  { value: "aesthetic", label: "Estética" },
] as const

interface DadosWorkspaceProps {
  order: ServiceOrder
}

export function DadosWorkspace({ order }: DadosWorkspaceProps) {
  const router = useRouter()
  const [personDirtyData, setPersonDirtyData] = useState<PersonPatch | null>(null)

  const form = useForm<ServiceOrderUpdateInput>({
    resolver: zodResolver(serviceOrderUpdateSchema),
    defaultValues: buildFormDefaults(order),
  })
  const { register, control, watch, setValue, formState: { dirtyFields, errors } } = form

  // isDirty do RHF fica true por causa de z.preprocess — usar dirtyFields.
  const isDirty = Object.keys(dirtyFields).length > 0 || personDirtyData !== null

  const customerType = useWatch({ control, name: "customer_type" }) ?? "private"
  const { data: consultants = [], isLoading: loadingConsultants } = useConsultants()

  // Previsão calculada: entrada + dias de reparo
  const entryDate = watch("entry_date")
  const repairDays = watch("repair_days")
  useEffect(() => {
    if (entryDate && repairDays && repairDays > 0) {
      const d = new Date(entryDate)
      d.setDate(d.getDate() + repairDays)
      setValue(
        "estimated_delivery_date",
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      )
    }
  }, [entryDate, repairDays, setValue])

  const updateMutation = useServiceOrderUpdate(order.id)
  const personUpdateMutation = usePersonUpdate(order.customer_person_id ?? null)
  const isPending = updateMutation.isPending || personUpdateMutation.isPending

  async function onSubmit(data: ServiceOrderUpdateInput) {
    try {
      const patch: Record<string, unknown> = {}
      for (const key of Object.keys(dirtyFields)) {
        patch[key] = data[key as keyof ServiceOrderUpdateInput]
      }
      const savedOrder = await updateMutation.mutateAsync(patch as ServiceOrderUpdateInput)
      form.reset(buildFormDefaults(savedOrder))
      if (personDirtyData && order.customer_person_id) {
        await personUpdateMutation.mutateAsync(personDirtyData)
        setPersonDirtyData(null)
      }
      toast.success("Dados salvos.")
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          form.setError(field as keyof ServiceOrderUpdateInput, {
            type: "server",
            message: messages[0],
          })
        }
        toast.error("Erro de validação. Verifique os campos destacados.")
      } else {
        toast.error("Erro ao salvar. Tente novamente.")
      }
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="relative mx-auto max-w-6xl space-y-3 pb-14">
      {/* ── Atendimento ─────────────────────────────────────────────── */}
      <Panel icon={<ClipboardList className="h-4 w-4" />} title="Atendimento">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className={FORM_LABEL}>Atendimento *</span>
            <Controller
              name="customer_type"
              control={control}
              render={({ field }) => (
                <div className="flex h-9 rounded-lg border border-border bg-muted/30 p-1">
                  {(["private", "insurer"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => field.onChange(type)}
                      className={cn(
                        "flex-1 rounded-md text-xs font-medium transition-colors",
                        field.value === type
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {type === "private" ? "Particular" : "Seguradora"}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div>
            <span className={FORM_LABEL}>Tipo de OS</span>
            <NativeSelect {...register("os_type")}>
              <option value="">Selecionar...</option>
              {OS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <span className={FORM_LABEL}>
              Consultor
              {loadingConsultants && <Loader2 className="ml-1 inline h-2.5 w-2.5 animate-spin" />}
            </span>
            <Controller
              name="consultant_id"
              control={control}
              render={({ field }) => (
                <NativeSelect
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  disabled={loadingConsultants}
                >
                  <option value="">Selecionar...</option>
                  {consultants.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </NativeSelect>
              )}
            />
          </div>

          {customerType === "private" && (
            <div>
              <span className={FORM_LABEL}>Data do orçamento</span>
              <input className={FORM_INPUT} type="date" {...register("quotation_date")} />
            </div>
          )}
        </div>
      </Panel>

      {/* ── Duas colunas em telas largas ────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
      <div className="space-y-3">
      {/* ── Cliente ─────────────────────────────────────────────────── */}
      <Panel icon={<User className="h-4 w-4" />} title="Cliente">
        <CustomerSection form={form} onPersonDataChange={setPersonDirtyData} />
      </Panel>

      {customerType === "insurer" && (
        <Panel icon={<Shield className="h-4 w-4" />} title="Seguradora">
          <InsurerSection form={form} />
        </Panel>
      )}

      {/* ── Linha do tempo ──────────────────────────────────────────── */}
      <Panel
        icon={<MilestoneIcon className="h-4 w-4" />}
        title="Linha do tempo"
        subtitle="⚡ muda o status automaticamente"
      >
        <MilestoneTimeline form={form} />
      </Panel>
      </div>

      <div className="space-y-3">
      {/* ── Veículo ─────────────────────────────────────────────────── */}
      <Panel icon={<Car className="h-4 w-4" />} title="Veículo">
        <VehicleSection form={form} osId={order.id} />
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div>
            <span className={FORM_LABEL}>KM de entrada</span>
            <input
              className={FORM_INPUT}
              type="text"
              inputMode="numeric"
              placeholder="0"
              {...register("mileage_in", {
                setValueAs: (v: string) => {
                  const n = parseInt(String(v).replace(/\D/g, ""), 10)
                  return isNaN(n) ? undefined : n
                },
              })}
            />
            {errors.mileage_in && (
              <p className="mt-0.5 text-xs text-error-400">{errors.mileage_in.message}</p>
            )}
          </div>
          <div>
            <span className={FORM_LABEL}>Localização</span>
            <NativeSelect {...register("vehicle_location")}>
              <option value="workshop">Na Oficina</option>
              <option value="in_transit">Em Trânsito</option>
            </NativeSelect>
          </div>
        </div>
      </Panel>

      {/* ── Planejamento ────────────────────────────────────────────── */}
      <Panel icon={<CalendarClock className="h-4 w-4" />} title="Planejamento de entrega">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <span className={FORM_LABEL}>Previsão de entrega</span>
            <input
              className={FORM_INPUT}
              type="datetime-local"
              {...register("delivery_date")}
            />
          </div>
          <div>
            <span className={FORM_LABEL}>Dias de reparo</span>
            <input
              className={FORM_INPUT}
              type="number"
              min="1"
              placeholder="Ex: 10"
              {...register("repair_days", { valueAsNumber: true })}
            />
          </div>
          <div>
            <span className={FORM_LABEL}>Calculada (entrada + dias)</span>
            <input
              className={`${FORM_INPUT} cursor-default opacity-70`}
              type="date"
              readOnly
              tabIndex={-1}
              {...register("estimated_delivery_date")}
            />
          </div>
        </div>
      </Panel>
      </div>
      </div>

      {/* ── Barra de salvar ─────────────────────────────────────────── */}
      {isDirty && (
        // bottom-20 deixa a barra acima do DockNav/MobileTabBar (fixed bottom z-40)
        <div className="sticky bottom-20 z-10 -mx-1 flex items-center justify-between rounded-xl border border-border bg-background/95 px-4 py-3 backdrop-blur">
          <p className="text-xs text-muted-foreground">Alterações não salvas</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                form.reset(buildFormDefaults(order))
                setPersonDirtyData(null)
              }}
            >
              Descartar
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}

/* ─── Painel ──────────────────────────────────────────────────────────── */

function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card/50">
      <header className="flex items-center gap-2 border-b border-border px-3.5 py-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && (
          <p className="ml-auto hidden text-xs text-muted-foreground sm:block">{subtitle}</p>
        )}
      </header>
      <div className="p-3.5">{children}</div>
    </section>
  )
}
