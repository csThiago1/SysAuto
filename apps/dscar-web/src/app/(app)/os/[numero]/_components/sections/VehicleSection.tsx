"use client"

import { useEffect, useState } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { History } from "lucide-react"
import { toast } from "sonner"
import { usePlateLookup } from "../../_hooks/useVehicleCatalog"
import { useVehicleHistory } from "../../_hooks/useVehicleHistory"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import {
  FORM_SECTION_TITLE, FORM_LABEL, FORM_INPUT, FORM_ERROR, FORM_WARN,
  formatPlate, onlyAlnum,
} from "@paddock/utils"
import { ColorSelect } from "../shared/ColorSelect"
import { VehicleHistorySheet } from "../shared/VehicleHistorySheet"
import { VehicleFipeFields } from "@/components/vehicle/VehicleFipeFields"

const FUEL_TYPE_PT: Record<string, string> = {
  gasoline: "Gasolina", Gasoline: "Gasolina",
  ethanol: "Etanol", Ethanol: "Etanol",
  diesel: "Diesel", Diesel: "Diesel",
  flex: "Flex", Flex: "Flex",
  electric: "Elétrico", Electric: "Elétrico",
  hybrid: "Híbrido", Hybrid: "Híbrido",
  gas: "GNV", Gas: "GNV",
}

interface VehicleSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
  osId?: string
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

export function VehicleSection({ form, osId, hideHeading }: VehicleSectionProps) {
  const { register, control, setValue, watch, formState: { errors } } = form
  const [plateQuery, setPlateQuery] = useState("")
  const { data: plateData, isFetching, error } = usePlateLookup(plateQuery)

  const makeLogo = watch("make_logo")
  const plate = watch("plate") ?? ""
  const [historyOpen, setHistoryOpen] = useState(false)
  const { data: vehicleHistory } = useVehicleHistory(plate, osId)
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
    if (v.length >= 7) setPlateQuery(v)
  }

  useEffect(() => {
    if (!plateData || !plateQuery || isFetching) return
    const currentMake = watch("make")
    if (!currentMake && plateData.make) {
      setValue("make", plateData.make)
      setValue("model", plateData.model)
      if (plateData.make_logo) setValue("make_logo", plateData.make_logo)
      if (plateData.version) setValue("vehicle_version", plateData.version)
      if (plateData.year) setValue("year", plateData.year)
      if (plateData.chassis) setValue("chassis", plateData.chassis)
      if (plateData.color) setValue("color", plateData.color)
      if (plateData.fuel_type) setValue("fuel_type", FUEL_TYPE_PT[plateData.fuel_type] ?? plateData.fuel_type)
      toast.success("Dados do veículo preenchidos pela placa!")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateData, isFetching])

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

      {/* Placa na mesma grade de 6 colunas do resto do painel. O logo saiu
          daqui: como bloco lateral ele criava uma coluna que ficava vazia nas
          linhas seguintes — era a maior mancha de espaco morto do painel. */}
      <div className="grid grid-cols-6 gap-x-2 gap-y-5">
        <div className="col-span-3 sm:col-span-2">
          <div className="flex items-baseline justify-between gap-2">
            <label className={FORM_LABEL}>Placa *</label>
            {hideHeading && hasHistory && (
              <HistoryButton count={vehicleHistory?.summary.os_count} onClick={() => setHistoryOpen(true)} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {makeLogo && (
              <img
                src={makeLogo}
                alt=""
                className="h-9 w-9 shrink-0 rounded-md bg-muted/30 object-contain p-1"
              />
            )}
            {/* Mesma altura e fundo dos demais campos; o que a distingue e a
                fonte de placa (Rajdhani + tracking), nao uma moldura propria. */}
            <input
              className={`${FORM_INPUT} font-plate text-base font-bold uppercase tracking-[0.08em]`}
              type="text"
              placeholder="ABC-1D23"
              maxLength={8}
              {...register("plate")} aria-invalid={!!errors.plate}
              value={formatPlate(plate)}
              onChange={handlePlateChange}
            />
            {isFetching && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
            )}
          </div>
          {errors.plate && (
            <p className={FORM_ERROR}>{errors.plate.message}</p>
          )}
          {error && (
            <p className={FORM_WARN}>Placa não encontrada — preencha manualmente</p>
          )}
        </div>
      </div>

      {/* Montadora / Modelo / Versão — FIPE autocomplete */}
      <VehicleFipeFields
        initialMake={watch("make") ?? ""}
        initialModel={watch("model") ?? ""}
        initialYear={watch("year")}
        initialVersion={watch("vehicle_version") ?? ""}
        onFieldChange={(fields) => {
          setValue("make", fields.make, { shouldDirty: true })
          setValue("model", fields.model, { shouldDirty: true })
          if (fields.vehicle_version) setValue("vehicle_version", fields.vehicle_version, { shouldDirty: true })
          if (fields.year) setValue("year", fields.year, { shouldDirty: true })
          if (fields.fuel_type) setValue("fuel_type", FUEL_TYPE_PT[fields.fuel_type] ?? fields.fuel_type, { shouldDirty: true })
        }}
        labelClass={FORM_LABEL}
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
        <div className="col-span-3 sm:col-span-2">
          <label className={FORM_LABEL}>Combustível</label>
          <input className={FORM_INPUT} type="text" placeholder="Flex, Gasolina..." {...register("fuel_type")} aria-invalid={!!errors.fuel_type} />
        </div>
        <div className="col-span-3 sm:col-span-2">
          <label className={FORM_LABEL}>Ano</label>
          <input
            className={FORM_INPUT}
            type="number"
            min={1900}
            max={2100}
            placeholder="2024"
            {...register("year", { valueAsNumber: true })} aria-invalid={!!errors.year}
          />
        </div>
      </div>

      <div className="grid grid-cols-6 gap-x-2 gap-y-5">
        <div className="col-span-6 sm:col-span-4">
          <label className={FORM_LABEL}>Chassi</label>
          <input className={FORM_INPUT} type="text" maxLength={17} placeholder="17 caracteres" {...register("chassis")} aria-invalid={!!errors.chassis} />
        </div>
        <div className="col-span-3 sm:col-span-2">
          <label className={FORM_LABEL}>FIPE (R$)</label>
          <input
            className={FORM_INPUT}
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            {...register("fipe_value", { valueAsNumber: true })} aria-invalid={!!errors.fipe_value}
          />
        </div>
      </div>

      {/* Hidden field para persistir make_logo */}
      <input type="hidden" {...register("make_logo")} aria-invalid={!!errors.make_logo} />

      <VehicleHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        plate={plate}
        make={watch("make") ?? undefined}
        model={watch("model") ?? undefined}
        year={watch("year") ?? undefined}
        makeLogo={makeLogo ?? undefined}
        excludeId={osId}
      />
    </div>
  )
}
