"use client"

import { useState } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { History } from "lucide-react"
import { toast } from "sonner"
import type { ServiceOrder } from "@paddock/types"
import { useVehicleHistory } from "../../_hooks/useVehicleHistory"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import {
  FORM_SECTION_TITLE, FORM_LABEL, FORM_INPUT, FORM_ERROR, FORM_WARN,
  formatCurrency, formatPlate, onlyAlnum,
} from "@paddock/utils"
import { ColorSelect } from "../shared/ColorSelect"
import { VehicleHistorySheet } from "../shared/VehicleHistorySheet"
import { VehicleCatalogPicker } from "@/components/vehicle/VehicleCatalogPicker"
import {
  ChassiHint,
  RestricaoAlert,
  SinespHint,
  keepYearManufacture,
  placaPrefill,
  useVehicleLookup,
} from "@/components/vehicle/PlacaLookup"
import { applyIfEmpty } from "@/lib/prefill"

interface VehicleSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  order: ServiceOrder
  /** O container ja rotula a secao (Panel "Veiculo") — nao repetir o heading. */
  hideHeading?: boolean
}

/** Consulta o histórico de OS do mesmo veículo. */
function HistoryButton({ count, onClick }: { count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <History className="h-3.5 w-3.5" />
      Histórico ({count})
    </button>
  )
}

export function VehicleSection({ form, order, hideHeading }: VehicleSectionProps) {
  const { register, control, setValue, watch, formState: { errors } } = form
  const placa = useVehicleLookup("placa", (fields) => {
    applyIfEmpty(form, placaPrefill(fields, form.getValues("catalog_selection")))
    toast.success("Dados do veículo preenchidos pela placa!")
  })
  const chassiLookup = useVehicleLookup("chassi", (fields) => {
    applyIfEmpty(form, placaPrefill(fields, form.getValues("catalog_selection")))
    toast.success("Dados do veículo preenchidos pelo chassi!")
  })

  const plate = watch("plate") ?? ""
  const [historyOpen, setHistoryOpen] = useState(false)
  const { data: vehicleHistory } = useVehicleHistory(plate, order.id)
  const hasHistory = (vehicleHistory?.summary.os_count ?? 0) > 0

  /**
   * Guarda a placa SEM hifen: o backend indexa `plate` assim e normaliza com
   * `.replace("-", "")`. O hifen so existe na tela.
   */
  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = onlyAlnum(e.target.value)
    // shouldDirty: este onChange substitui o do register, entao sem isto o campo
    // nunca entrava em dirtyFields e a barra de salvar nao aparecia ao editar a placa.
    setValue("plate", v, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <div className="space-y-2">
      {/* Sem heading, a linha inteira (titulo + divisor + acao) sai: o botao
          de historico passa a acompanhar o campo Placa, que e o que ele
          consulta. Uma linha a menos por painel. */}
      {!hideHeading && (
        <div className="flex items-center justify-between border-b pb-1.5">
          <span className={FORM_SECTION_TITLE}>Dados do Veículo</span>
          {hasHistory && <HistoryButton count={vehicleHistory?.summary.os_count} onClick={() => setHistoryOpen(true)} />}
        </div>
      )}

      <div className="grid grid-cols-6 gap-x-2 gap-y-5">
        <div className="col-span-6 sm:col-span-4">
          <div className="flex items-baseline justify-between gap-2">
            <label className={FORM_LABEL}>Placa *</label>
            {hideHeading && hasHistory && (
              <HistoryButton count={vehicleHistory?.summary.os_count} onClick={() => setHistoryOpen(true)} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Mesma altura e fundo dos demais campos; o que a distingue e a
                fonte de placa (Rajdhani + tracking), nao uma moldura propria. */}
            <input
              className={`${FORM_INPUT} font-plate text-base font-bold uppercase tracking-[0.08em]`}
              type="text"
              placeholder="ABC-1D23"
              maxLength={8}
              {...register("plate", { onBlur: () => placa.lookup(form.getValues("plate")) })}
              aria-invalid={!!errors.plate}
              value={formatPlate(plate)}
              onChange={handlePlateChange}
            />
            <button
              type="button"
              onClick={() => placa.lookup(form.getValues("plate"))}
              disabled={placa.isFetching}
              className="h-9 shrink-0 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Consultar
            </button>
            {placa.isFetching && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
            )}
          </div>
          {errors.plate && (
            <p className={FORM_ERROR}>{errors.plate.message}</p>
          )}
          {placa.notFound && (
            <p className={FORM_WARN}>Placa não encontrada — escolha o veículo na lista</p>
          )}
        </div>
      </div>

      <RestricaoAlert restricao={placa.result?.fields.restricao} />

      <SinespHint searched={placa.searched} />

      <Controller
        name="catalog_selection"
        control={control}
        render={({ field }) => (
          <VehicleCatalogPicker
            value={field.value ?? null}
            onChange={(sel) => {
              setValue(
                "year_manufacture",
                keepYearManufacture(field.value, sel, form.getValues("year_manufacture")),
                { shouldDirty: true },
              )
              field.onChange(sel)
            }}
            sourceText={order.vehicle_source_text || undefined}
            error={errors.catalog_selection?.message}
          />
        )}
      />

      <div className="grid grid-cols-6 gap-x-2 gap-y-5">
        <div className="col-span-3 sm:col-span-2">
          <label className={FORM_LABEL}>Cor</label>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <ColorSelect value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
        </div>
        {/* Combustível e FIPE vêm da versão do catálogo (snapshot do servidor): só leitura. */}
        <div className="col-span-3 sm:col-span-2">
          <span className={FORM_LABEL}>Combustível</span>
          <p className="text-sm text-foreground">{order.fuel_type || "—"}</p>
        </div>
        <div className="col-span-3 sm:col-span-2">
          <span className={FORM_LABEL}>FIPE</span>
          <p className="text-sm tabular-nums text-foreground">
            {order.fipe_value ? formatCurrency(order.fipe_value) : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-x-2 gap-y-5">
        <div className="col-span-6 sm:col-span-4">
          <label className={FORM_LABEL}>Chassi</label>
          <input
            className={FORM_INPUT}
            type="text"
            maxLength={17}
            placeholder="17 caracteres"
            {...register("chassis", { onBlur: () => chassiLookup.lookup(form.getValues("chassis")) })}
            aria-invalid={!!errors.chassis}
          />
          {chassiLookup.notFound && (
            <p className={FORM_WARN}>Chassi não encontrado — escolha o veículo na lista</p>
          )}
          <ChassiHint result={chassiLookup.result} />
        </div>
      </div>

      <VehicleHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        plate={plate}
        make={order.make || undefined}
        model={order.model || undefined}
        year={order.year ?? undefined}
        makeLogo={order.make_logo || undefined}
        excludeId={order.id}
      />
    </div>
  )
}
