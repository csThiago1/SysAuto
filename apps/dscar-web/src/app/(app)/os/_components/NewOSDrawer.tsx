"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { newOSSchema, toCreatePayload, type NewOSInput } from "./new-os.schema"
import { useServiceOrderCreate } from "../[numero]/_hooks/useServiceOrder"
import { CustomerSearch } from "../[numero]/_components/shared/CustomerSearch"
import { InsurerSelect } from "../[numero]/_components/shared/InsurerSelect"
import { ColorSelect } from "../[numero]/_components/shared/ColorSelect"
import { VehicleCatalogPicker } from "@/components/vehicle/VehicleCatalogPicker"
import { RestricaoAlert, placaPrefill, usePlacaLookup } from "@/components/vehicle/PlacaLookup"
import { applyIfEmpty } from "@/lib/prefill"
import { ApiError, handleApiFormError } from "@/lib/api"
import { formatPlate } from "@paddock/utils"

const LABEL = "block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-0.5"
const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
const INPUT_ERROR =
  "flex h-8 w-full rounded-md border border-red-400 bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-red-400"
const SELECT = INPUT

const OS_TYPES = [
  { value: "bodywork", label: "Chapeação", desc: "Reparo de lataria e estrutura" },
  { value: "warranty", label: "Garantia", desc: "Coberto pela garantia de serviço anterior" },
  { value: "rework", label: "Retrabalho", desc: "Correção de serviço que não ficou conforme" },
  { value: "mechanical", label: "Mecânica", desc: "Serviço mecânico geral" },
  { value: "aesthetic", label: "Estética", desc: "Polimento, higienização, estética veicular" },
] as const

interface NewOSDrawerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function NewOSDrawer({ open, onOpenChange }: NewOSDrawerProps) {
  const router = useRouter()
  const createMutation = useServiceOrderCreate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<NewOSInput>({
    resolver: zodResolver(newOSSchema),
    defaultValues: {
      customer_type: "private",
      customer_id: null,
      customer_name: "",
      plate: "",
      catalog_selection: null,
      year_manufacture: null,
      color: "",
      chassis: "",
    },
  })
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = form

  const placa = usePlacaLookup((fields) => {
    applyIfEmpty(form, placaPrefill(fields, form.getValues("catalog_selection")))
    toast.success("Dados do veículo preenchidos pela placa.")
  })

  const customerType = watch("customer_type")
  const hasDirtyFields = Object.keys(dirtyFields).length > 0

  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      reset()
      setServerError(null)
    }, 300)
  }

  /** Previne fechamento acidental do Sheet quando tem dados preenchidos ou erro */
  function handleOpenChange(v: boolean) {
    if (!v && (isSubmitting || serverError || hasDirtyFields)) return
    onOpenChange(v)
  }

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8)
    setValue("plate", val, { shouldDirty: true })
  }

  async function onSubmit(data: NewOSInput) {
    setServerError(null)
    try {
      const os = await createMutation.mutateAsync(toCreatePayload(data))
      handleClose()
      router.push(`/os/${os.number}`)
    } catch (err) {
      if (err instanceof ApiError) {
        handleApiFormError(err, setError)
        if (err.message) setServerError(err.message)
      } else {
        setServerError("Erro ao criar OS. Tente novamente.")
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[420px] overflow-y-auto"
        aria-describedby={undefined}
      >
        <SheetHeader className="mb-4">
          <SheetTitle>Nova Ordem de Serviço</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo de atendimento */}
          <div>
            <label className={LABEL}>Atendimento *</label>
            <Controller
              name="customer_type"
              control={control}
              render={({ field }) => (
                <div className="flex rounded-lg border border-border bg-muted/50 p-0.5 w-fit">
                  {(["private", "insurer"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => field.onChange(type)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        field.value === type
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground/70"
                      }`}
                    >
                      {type === "private" ? "Particular" : "Seguradora"}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Seguradora (condicional) */}
          {customerType === "insurer" && (
            <div className="rounded-lg border border-dashed border-info-500/20 bg-info-500/10 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Dados da Seguradora
              </p>
              <div>
                <label className={LABEL}>Seguradora *</label>
                <Controller
                  name="insurer"
                  control={control}
                  render={({ field }) => (
                    <InsurerSelect
                      value={field.value ?? null}
                      onChange={(insurerId) => field.onChange(insurerId)}
                    />
                  )}
                />
                {errors.insurer && (
                  <p className="mt-0.5 text-xs text-error-400">
                    {errors.insurer.message}
                  </p>
                )}
              </div>
              <div>
                <label className={LABEL}>Tipo de segurado *</label>
                <select className={SELECT} {...register("insured_type")} aria-invalid={!!errors.insured_type}>
                  <option value="">Selecionar...</option>
                  <option value="insured">Segurado</option>
                  <option value="third">Terceiro</option>
                </select>
              </div>
            </div>
          )}

          {/* Cliente */}
          <div>
            <label className={LABEL}>Cliente</label>
            <Controller
              name="customer_id"
              control={control}
              render={({ field }) => (
                <CustomerSearch
                  value={
                    field.value != null
                      ? { id: field.value, name: watch("customer_name") ?? "" }
                      : null
                  }
                  onChange={(c) => {
                    field.onChange(c?.id ?? null)
                    setValue("customer_name", c?.name ?? "")
                  }}
                />
              )}
            />
          </div>

          {/* Tipo OS */}
          <div>
            <label className={LABEL}>Tipo OS <span className="font-normal text-muted-foreground/60">(opcional)</span></label>
            <select className={SELECT} {...register("os_type")} aria-invalid={!!errors.os_type}>
              <option value="">Selecionar...</option>
              {OS_TYPES.map((t) => (
                <option key={t.value} value={t.value} title={t.desc}>
                  {t.label} — {t.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Veículo */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Veículo
            </p>

            {/* Placa */}
            <div>
              <label className={LABEL}>Placa *</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    className={errors.plate ? INPUT_ERROR : INPUT}
                    placeholder="ABC-1D23"
                    value={formatPlate(watch("plate") ?? "")}
                    onChange={handlePlateChange}
                    onBlur={() => placa.lookup(watch("plate"))}
                    maxLength={8}
                    autoCapitalize="characters"
                    data-testid="plate-input"
                  />
                  {placa.isFetching && (
                    <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => placa.lookup(watch("plate"))}
                  disabled={placa.isFetching}
                  className="h-8 rounded-md border border-border px-3 text-xs font-medium text-foreground/70 hover:bg-muted/30 disabled:opacity-50"
                >
                  Consultar
                </button>
              </div>
              {errors.plate && (
                <p className="mt-0.5 text-xs text-error-400">
                  {errors.plate.message}
                </p>
              )}
              {placa.notFound && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Placa não encontrada — escolha o veículo na lista.
                </p>
              )}
            </div>
            <RestricaoAlert restricao={placa.restricao} />

            <Controller
              name="catalog_selection"
              control={control}
              render={({ field }) => (
                <VehicleCatalogPicker
                  value={field.value ?? null}
                  onChange={(sel) => {
                    field.onChange(sel)
                    // ponytail: o ano de fabricação é do veículo anterior; sem campo para corrigi-lo
                    setValue("year_manufacture", null)
                  }}
                  error={errors.catalog_selection?.message}
                />
              )}
            />

            <div>
              <label className={LABEL}>Cor <span className="font-normal text-muted-foreground/60">(opcional)</span></label>
              <Controller
                name="color"
                control={control}
                render={({ field }) => (
                  <ColorSelect
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          {serverError && (
            <p className="rounded border border-error-500/20 bg-error-500/10 px-3 py-2 text-xs text-error-400">
              {serverError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              data-testid="cancelar-os-btn"
              className="rounded border border-border px-4 py-1.5 text-sm font-medium text-foreground/60 hover:bg-muted/30"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="criar-os-btn"
              className="flex items-center gap-1.5 rounded bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSubmitting ? "Criando..." : "Criar OS"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
