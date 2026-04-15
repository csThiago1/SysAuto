"use client"

import { useEffect, useState } from "react"
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
import { newOSSchema, type NewOSInput } from "../new/_schemas/new-os.schema"
import { useServiceOrderCreate } from "../[id]/_hooks/useServiceOrder"
import { CustomerSearch } from "../[id]/_components/shared/CustomerSearch"
import { InsurerSelect } from "../[id]/_components/shared/InsurerSelect"
import { ColorSelect } from "../[id]/_components/shared/ColorSelect"
import { usePlateLookup } from "../[id]/_hooks/useVehicleCatalog"
import { ApiError, handleApiFormError } from "@/lib/api"

const LABEL = "block text-xs font-bold uppercase tracking-wide text-neutral-400 mb-0.5"
const INPUT =
  "flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
const INPUT_ERROR =
  "flex h-8 w-full rounded-md border border-red-400 bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-red-400"
const SELECT = INPUT

const OS_TYPES = [
  { value: "bodywork", label: "Chapeação" },
  { value: "warranty", label: "Garantia" },
  { value: "rework", label: "Retrabalho" },
  { value: "mechanical", label: "Mecânica" },
  { value: "aesthetic", label: "Estética" },
] as const

interface NewOSDrawerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function NewOSDrawer({ open, onOpenChange }: NewOSDrawerProps) {
  const router = useRouter()
  const createMutation = useServiceOrderCreate()
  const [plateQuery, setPlateQuery] = useState("")
  const { data: plateData, isFetching: plateFetching } = usePlateLookup(plateQuery)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewOSInput>({
    resolver: zodResolver(newOSSchema),
    defaultValues: {
      customer_type: "private",
      customer_name: "",
      plate: "",
      make: "",
      model: "",
      vehicle_version: "",
      color: "",
      fuel_type: "",
      chassis: "",
    },
  })

  const customerType = watch("customer_type")

  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      reset()
      setServerError(null)
    }, 300)
  }

  // Auto-preenche campos do veículo ao consultar placa
  useEffect(() => {
    if (!plateData || !plateQuery || plateFetching) return
    const currentMake = watch("make")
    if (!currentMake && plateData.make) {
      setValue("make", plateData.make)
      setValue("model", plateData.model ?? "")
      if (plateData.year) setValue("year", plateData.year)
      toast.success("Dados do veículo preenchidos pela placa.")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateData, plateFetching])

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8)
    setValue("plate", val)
    if (val.length >= 7) setPlateQuery(val)
  }

  async function onSubmit(data: NewOSInput) {
    setServerError(null)
    try {
      const os = await createMutation.mutateAsync(data)
      handleClose()
      router.push(`/service-orders/${os.id}`)
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:max-w-[420px] overflow-y-auto"
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
                <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5 w-fit">
                  {(["private", "insurer"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => field.onChange(type)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        field.value === type
                          ? "bg-primary-600 text-white shadow-sm"
                          : "text-neutral-500 hover:text-neutral-700"
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
            <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 p-3 space-y-2">
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
                  <p className="mt-0.5 text-xs text-red-600">
                    {errors.insurer.message}
                  </p>
                )}
              </div>
              <div>
                <label className={LABEL}>Tipo de segurado *</label>
                <select className={SELECT} {...register("insured_type")}>
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
              name="customer"
              control={control}
              render={({ field }) => (
                <CustomerSearch
                  value={
                    field.value
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
            <label className={LABEL}>Tipo OS</label>
            <select className={SELECT} {...register("os_type")}>
              <option value="">Selecionar...</option>
              {OS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Veículo */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Veículo
            </p>

            {/* Placa */}
            <div>
              <label className={LABEL}>Placa *</label>
              <div className="relative">
                <input
                  className={errors.plate ? INPUT_ERROR : INPUT}
                  placeholder="ABC1D23"
                  value={watch("plate")}
                  onChange={handlePlateChange}
                  maxLength={8}
                  autoCapitalize="characters"
                />
                {plateFetching && (
                  <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-neutral-400" />
                )}
              </div>
              {errors.plate && (
                <p className="mt-0.5 text-xs text-red-600">
                  {errors.plate.message}
                </p>
              )}
            </div>

            {/* Montadora | Modelo */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>Montadora *</label>
                <input
                  className={errors.make ? INPUT_ERROR : INPUT}
                  placeholder="Ex: Honda"
                  {...register("make")}
                />
                {errors.make && (
                  <p className="mt-0.5 text-xs text-red-600">
                    {errors.make.message}
                  </p>
                )}
              </div>
              <div>
                <label className={LABEL}>Modelo *</label>
                <input
                  className={errors.model ? INPUT_ERROR : INPUT}
                  placeholder="Ex: Civic"
                  {...register("model")}
                />
                {errors.model && (
                  <p className="mt-0.5 text-xs text-red-600">
                    {errors.model.message}
                  </p>
                )}
              </div>
            </div>

            {/* Versão | Ano */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>Versão</label>
                <input
                  className={INPUT}
                  placeholder="Ex: EX"
                  {...register("vehicle_version")}
                />
              </div>
              <div>
                <label className={LABEL}>Ano</label>
                <input
                  className={INPUT}
                  type="number"
                  placeholder="Ex: 2022"
                  {...register("year", { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Cor | Combustível */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>Cor</label>
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
              <div>
                <label className={LABEL}>Combustível</label>
                <select className={SELECT} {...register("fuel_type")}>
                  <option value="">Selecionar...</option>
                  <option value="flex">Flex</option>
                  <option value="gasoline">Gasolina</option>
                  <option value="ethanol">Etanol</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Elétrico</option>
                  <option value="hybrid">Híbrido</option>
                </select>
              </div>
            </div>
          </div>

          {serverError && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {serverError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
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
