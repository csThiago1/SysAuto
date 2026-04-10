"use client"

import { useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2, Car, User, FileText, Building2 } from "lucide-react"
import { toast } from "sonner"

import { newOSSchema, type NewOSInput } from "../_schemas/new-os.schema"
import { useServiceOrderCreate } from "../../[id]/_hooks/useServiceOrder"
import { ApiError } from "@/lib/api"
import { CustomerSearch } from "../../[id]/_components/shared/CustomerSearch"
import { InsurerSelect } from "../../[id]/_components/shared/InsurerSelect"
import { ColorSelect } from "../../[id]/_components/shared/ColorSelect"
import { usePlateLookup } from "../../[id]/_hooks/useVehicleCatalog"

const LABEL = "block text-xs font-medium text-neutral-600 mb-1"
const INPUT =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:bg-neutral-50"
const SELECT =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
const ERROR = "mt-1 text-xs text-red-600"
const CARD = "rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden"
const CARD_HEADER =
  "flex items-center gap-2 px-5 py-3 border-b border-neutral-100 bg-neutral-50"
const CARD_TITLE = "text-xs font-semibold uppercase tracking-wide text-neutral-600"
const CARD_BODY = "p-5"

const OS_TYPES = [
  { value: "bodywork", label: "Chapeação" },
  { value: "warranty", label: "Garantia" },
  { value: "rework", label: "Retrabalho" },
  { value: "mechanical", label: "Mecânica" },
  { value: "aesthetic", label: "Estética" },
]

export function NewOSForm() {
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
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewOSInput>({
    resolver: zodResolver(newOSSchema),
    defaultValues: {
      customer_type: "private",
      customer_name: "",
      plate: "",
      make: "",
      model: "",
      color: "",
    },
  })

  const customerType = watch("customer_type")

  // Auto-preenche campos do veículo quando a API de placa retorna dados
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
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    setValue("plate", raw, { shouldValidate: raw.length >= 7 })
    if (raw.length >= 7) setPlateQuery(raw)
  }

  async function onSubmit(data: NewOSInput) {
    setServerError(null)
    console.log("[NewOSForm] submitting:", JSON.stringify(data))
    try {
      const created = await createMutation.mutateAsync(data)
      router.push(`/service-orders/${created.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        console.error("[NewOSForm] ApiError:", err.status, err.message, err.fieldErrors)
        // Mapeia erros de campo do backend para o form
        if (err.fieldErrors) {
          Object.entries(err.fieldErrors).forEach(([field, messages]) => {
            setError(field as keyof NewOSInput, { message: messages[0] })
          })
        }
        const detail = err.fieldErrors
          ? `Campos com erro: ${Object.entries(err.fieldErrors).map(([k,v]) => `${k}: ${v[0]}`).join("; ")}`
          : (err.nonFieldErrors?.[0] ?? err.message)
        setServerError(detail)
      } else {
        console.error("[NewOSForm] unexpected error:", err)
        setServerError("Erro inesperado. Tente novamente.")
      }
    }
  }

  const isPending = isSubmitting || createMutation.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-5 max-w-2xl">

        {/* ── Tipo de atendimento ──────────────────────────────── */}
        <div className={CARD}>
          <div className={CARD_HEADER}>
            <FileText className="h-4 w-4 text-neutral-500" />
            <h2 className={CARD_TITLE}>Tipo de atendimento</h2>
          </div>
          <div className={CARD_BODY}>
            <div className="grid grid-cols-2 gap-3">
              {(["private", "insurer"] as const).map((type) => (
                <Controller
                  key={type}
                  name="customer_type"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(type)}
                      className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors text-left ${
                        field.value === type
                          ? "border-[#ea0e03] bg-red-50 text-[#ea0e03]"
                          : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                      }`}
                    >
                      <span className="block font-semibold">
                        {type === "private" ? "Particular" : "Seguradora"}
                      </span>
                      <span className="block text-xs font-normal mt-0.5 opacity-70">
                        {type === "private"
                          ? "Cliente paga diretamente"
                          : "Atendimento via apólice"}
                      </span>
                    </button>
                  )}
                />
              ))}
            </div>

            {/* Tipo de OS */}
            <div className="mt-4">
              <label className={LABEL}>Tipo de OS</label>
              <Controller
                name="os_type"
                control={control}
                render={({ field }) => (
                  <select
                    className={SELECT}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  >
                    <option value="">Selecionar (opcional)...</option>
                    {OS_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                )}
              />
            </div>
          </div>
        </div>

        {/* ── Seguradora (condicional) ─────────────────────────── */}
        {customerType === "insurer" && (
          <div className={CARD}>
            <div className={CARD_HEADER}>
              <Building2 className="h-4 w-4 text-neutral-500" />
              <h2 className={CARD_TITLE}>Seguradora</h2>
            </div>
            <div className={CARD_BODY}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={LABEL}>Seguradora *</label>
                  <Controller
                    name="insurer"
                    control={control}
                    render={({ field }) => (
                      <InsurerSelect
                        value={field.value ?? null}
                        onChange={(id) => field.onChange(id)}
                      />
                    )}
                  />
                  {errors.insurer && <p className={ERROR}>{errors.insurer.message}</p>}
                </div>

                <div>
                  <label className={LABEL}>Segurado ou Terceiro *</label>
                  <Controller
                    name="insured_type"
                    control={control}
                    render={({ field }) => (
                      <select className={SELECT} {...field} value={field.value ?? ""}>
                        <option value="">Selecionar...</option>
                        <option value="insured">Segurado</option>
                        <option value="third">Terceiro</option>
                      </select>
                    )}
                  />
                  {errors.insured_type && (
                    <p className={ERROR}>{errors.insured_type.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Cliente ──────────────────────────────────────────── */}
        <div className={CARD}>
          <div className={CARD_HEADER}>
            <User className="h-4 w-4 text-neutral-500" />
            <h2 className={CARD_TITLE}>Cliente</h2>
          </div>
          <div className={CARD_BODY}>
            {/* customer_name é hidden — auto-populado via CustomerSearch */}
            <input type="hidden" {...register("customer_name")} />

            <label className={LABEL}>Buscar cliente por CPF, nome ou telefone *</label>
            <Controller
              name="customer"
              control={control}
              render={({ field }) => (
                <CustomerSearch
                  value={
                    field.value
                      ? { id: field.value, name: watch("customer_name") }
                      : null
                  }
                  onChange={(c) => {
                    field.onChange(c?.id ?? null)
                    setValue("customer_name", c?.name ?? "", { shouldValidate: true })
                  }}
                />
              )}
            />
            {errors.customer_name && (
              <p className={ERROR}>{errors.customer_name.message}</p>
            )}
          </div>
        </div>

        {/* ── Veículo ──────────────────────────────────────────── */}
        <div className={CARD}>
          <div className={CARD_HEADER}>
            <Car className="h-4 w-4 text-neutral-500" />
            <h2 className={CARD_TITLE}>Veículo</h2>
          </div>
          <div className={CARD_BODY}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {/* Placa */}
              <div className="col-span-2 sm:col-span-1">
                <label className={LABEL}>Placa *</label>
                <div className="relative">
                  <input
                    className={INPUT}
                    type="text"
                    placeholder="ABC1D23"
                    maxLength={8}
                    {...register("plate")}
                    onChange={handlePlateChange}
                  />
                  {plateFetching && (
                    <Loader2 className="absolute right-2.5 top-2 h-4 w-4 animate-spin text-neutral-400" />
                  )}
                </div>
                {errors.plate && <p className={ERROR}>{errors.plate.message}</p>}
              </div>

              {/* Marca */}
              <div>
                <label className={LABEL}>Marca</label>
                <input className={INPUT} type="text" placeholder="Honda" {...register("make")} />
              </div>

              {/* Modelo */}
              <div>
                <label className={LABEL}>Modelo</label>
                <input className={INPUT} type="text" placeholder="Civic" {...register("model")} />
              </div>

              {/* Ano */}
              <div>
                <label className={LABEL}>Ano</label>
                <input
                  className={INPUT}
                  type="number"
                  min={1900}
                  max={2100}
                  placeholder={String(new Date().getFullYear())}
                  {...register("year", { valueAsNumber: true })}
                />
              </div>

              {/* Cor */}
              <div className="col-span-2">
                <label className={LABEL}>Cor</label>
                <Controller
                  name="color"
                  control={control}
                  render={({ field }) => (
                    <ColorSelect value={field.value ?? ""} onChange={field.onChange} />
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Botão de criação ─────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-md bg-[#ea0e03] px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? "Criando..." : "Criar OS"}
          </button>
        </div>

        {/* Erros de servidor */}
        {serverError && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-xs font-medium text-red-700">{serverError}</p>
          </div>
        )}

        {/* Erros de validação Zod */}
        {Object.keys(errors).length > 0 && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-xs font-medium text-red-700">Corrija os campos antes de continuar:</p>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(errors).map(([field, err]) => (
                <li key={field} className="text-xs text-red-600">
                  • {err?.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </form>
  )
}
