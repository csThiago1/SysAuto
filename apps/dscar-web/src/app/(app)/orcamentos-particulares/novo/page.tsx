"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ReceiptText, ChevronLeft, Search, X, Loader2 } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQuery } from "@tanstack/react-query"
import { useCreateBudget } from "@/hooks/useBudgets"
import { formatPlate, onlyAlnum } from "@paddock/utils"
import { catalogSelectionSchema } from "@/components/vehicle/catalog.schema"
import { VehicleCatalogPicker } from "@/components/vehicle/VehicleCatalogPicker"
import {
  RestricaoAlert,
  SinespHint,
  keepYearManufacture,
  placaPrefill,
  usePlacaLookup,
} from "@/components/vehicle/PlacaLookup"
import { ColorSelect } from "@/app/(app)/os/[numero]/_components/shared/ColorSelect"
import { applyIfEmpty } from "@/lib/prefill"

const budgetFormSchema = z.object({
  customer: z
    .object({ id: z.number(), name: z.string() })
    .nullable()
    .refine((c) => Boolean(c), "Selecione um cliente."),
  plate: z.string().regex(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/, "Informe a placa do veículo."),
  catalog_selection: catalogSelectionSchema
    .nullable()
    .refine((s) => s?.family != null, "Escolha a montadora e o modelo."),
  year_manufacture: z.number().int().nullable(),
  color: z.string(),
  chassis: z.string().max(17),
})
type BudgetForm = z.infer<typeof budgetFormSchema>

interface PersonResult {
  id: number
  full_name: string
}

function usePersonSearch(search: string) {
  return useQuery({
    queryKey: ["persons", "search", search],
    queryFn: async () => {
      const res = await fetch(`/api/proxy/persons/?search=${encodeURIComponent(search)}`)
      if (!res.ok) throw new Error("Erro ao buscar pessoas")
      const data = await res.json() as { results?: PersonResult[] } | PersonResult[]
      if (!Array.isArray(data) && "results" in data) return data.results ?? []
      return data as PersonResult[]
    },
    enabled: search.length >= 2,
  })
}

export default function NovoBudgetPage() {
  const router = useRouter()
  const { mutateAsync: criar } = useCreateBudget()

  const [clienteSearch, setClienteSearch] = useState("")
  const { data: clientes = [] } = usePersonSearch(clienteSearch)

  const form = useForm<BudgetForm>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      customer: null,
      plate: "",
      catalog_selection: null,
      year_manufacture: null,
      color: "",
      chassis: "",
    },
  })
  const {
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form

  const placa = usePlacaLookup((fields) => {
    applyIfEmpty(form, placaPrefill(fields, form.getValues("catalog_selection")))
    toast.success("Dados do veículo preenchidos pela placa.")
  })

  const cliente = watch("customer")
  const chassi = watch("chassis")

  async function onSubmit(data: BudgetForm) {
    const family = data.catalog_selection?.family
    if (!data.customer || !family) return // o schema já barrou
    try {
      const budget = await criar({
        customer_id: data.customer.id,
        vehicle_plate: data.plate,
        catalog_family: family.id,
        catalog_version: data.catalog_selection?.version?.id ?? null,
        vehicle_color: data.color || "NAO_INFORMADA",
        vehicle_year_manufacture: data.year_manufacture,
        vehicle_chassis: data.chassis,
      })
      toast.success(`Orçamento ${budget.number} criado!`)
      router.push(`/orcamentos-particulares/${budget.id}` as Route)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar orçamento.")
    }
  }

  return (
    <div className="px-0 py-3 md:p-6 max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={"/orcamentos-particulares" as Route}>
          <Button variant="ghost" size="icon" title="Voltar" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <ReceiptText className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">Novo Orçamento Particular</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Cliente */}
        <div className="space-y-2">
          <Label className="text-foreground/70">Cliente</Label>
          {cliente ? (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 border border-border px-3 py-2">
              <span className="text-foreground text-sm">{cliente.name}</span>
              <button
                type="button"
                onClick={() => { setValue("customer", null); setClienteSearch("") }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome (mínimo 2 caracteres)..."
                  value={clienteSearch}
                  onChange={(e) => setClienteSearch(e.target.value)}
                  className="pl-9 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              {clientes.length > 0 && (
                <ul className="rounded-lg border border-border bg-card divide-y divide-white/5 max-h-48 overflow-y-auto">
                  {clientes.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50"
                        onClick={() => {
                          setValue("customer", { id: c.id, name: c.full_name }, { shouldValidate: true })
                          setClienteSearch("")
                        }}
                      >
                        {c.full_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {errors.customer && <p className="text-xs text-error-400">{errors.customer.message}</p>}
        </div>

        {/* Veículo */}
        <div className="space-y-3 rounded-xl border border-border bg-white/[0.02] p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Veículo</p>

          {/* Placa */}
          <div className="space-y-1.5">
            <Label className="text-foreground/70 text-xs">Placa *</Label>
            <div className="flex items-center gap-3">
              <Input
                placeholder="ABC-1D23"
                value={formatPlate(watch("plate"))}
                onChange={(e) =>
                  setValue("plate", onlyAlnum(e.target.value).toUpperCase().slice(0, 7), {
                    shouldDirty: true,
                  })
                }
                onBlur={() => placa.lookup(watch("plate"))}
                maxLength={8}
                data-testid="plate-input"
                className="w-32 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground font-mono uppercase tracking-widest font-bold"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => placa.lookup(watch("plate"))}
                disabled={placa.isFetching}
              >
                Consultar
              </Button>
              {placa.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {errors.plate && <p className="text-xs text-error-400">{errors.plate.message}</p>}
            {placa.notFound && (
              <p className="text-xs text-muted-foreground">
                Placa não encontrada — escolha o veículo na lista.
              </p>
            )}
          </div>
          <RestricaoAlert restricao={placa.restricao} />
          <SinespHint searched={placa.searched} />

          <Controller
            name="catalog_selection"
            control={control}
            render={({ field }) => (
              <VehicleCatalogPicker
                value={field.value}
                onChange={(sel) => {
                  setValue(
                    "year_manufacture",
                    keepYearManufacture(field.value, sel, form.getValues("year_manufacture")),
                  )
                  field.onChange(sel)
                }}
                error={errors.catalog_selection?.message}
              />
            )}
          />

          <div className="space-y-1.5">
            <Label className="text-foreground/70 text-xs">Cor</Label>
            <Controller
              name="color"
              control={control}
              render={({ field }) => <ColorSelect value={field.value} onChange={field.onChange} />}
            />
          </div>

          {/* Chassi */}
          <div className="space-y-1.5">
            <Label className="text-foreground/70 text-xs">Chassi</Label>
            <Input
              placeholder="9BWZZZ377VT004251"
              value={chassi}
              onChange={(e) =>
                setValue("chassis", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""), {
                  shouldDirty: true,
                })
              }
              maxLength={17}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground font-mono text-xs tracking-widest"
            />
            {chassi.length > 0 && chassi.length !== 17 && (
              <p className="text-xs text-warning-400">{chassi.length}/17 dígitos</p>
            )}
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting || placa.isFetching} className="w-full">
          {isSubmitting ? "Criando..." : "Criar Orçamento"}
        </Button>
      </form>
    </div>
  )
}
