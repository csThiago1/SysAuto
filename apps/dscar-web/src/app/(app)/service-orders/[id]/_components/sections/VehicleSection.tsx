"use client"

import { useEffect, useState } from "react"
import { Controller, type UseFormReturn } from "react-hook-form"
import { toast } from "sonner"
import { usePlateLookup } from "../../_hooks/useVehicleCatalog"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { FORM_SECTION_TITLE, FORM_LABEL, FORM_INPUT, FORM_ERROR, FORM_WARN } from "@paddock/utils"
import { ColorSelect } from "../shared/ColorSelect"

interface VehicleSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function VehicleSection({ form }: VehicleSectionProps) {
  const { register, control, setValue, watch, formState: { errors } } = form
  const [plateQuery, setPlateQuery] = useState("")
  const { data: plateData, isFetching, error } = usePlateLookup(plateQuery)

  const makeLogo = watch("make_logo")

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    setValue("plate", v)
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
      if (plateData.fuel_type) setValue("fuel_type", plateData.fuel_type)
      toast.success("Dados do veículo preenchidos pela placa!")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateData, isFetching])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b pb-1.5">
        <span className={FORM_SECTION_TITLE}>Dados do Veículo</span>
      </div>

      {/* Header: logo montadora + placa destaque */}
      <div className="flex items-start gap-3">
        {makeLogo ? (
          <img
            src={makeLogo}
            alt="Logo montadora"
            className="h-14 w-14 shrink-0 rounded-lg border border-white/10 bg-white/[0.03] object-contain p-1.5"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-lg border-2 border-dashed border-white/10 bg-white/[0.03] flex items-center justify-center">
            <span className="text-2xl">🚗</span>
          </div>
        )}

        {/* Placa destaque */}
        <div className="flex-1">
          <label className={FORM_LABEL}>Placa *</label>
          <div className="flex items-center gap-2">
            <input
              className="flex h-9 w-32 rounded-md border-2 border-input bg-background px-3 py-1 text-base font-bold font-mono tracking-widest shadow-sm focus:outline-none focus:ring-1 focus:ring-ring uppercase"
              type="text"
              placeholder="ABC1D23"
              maxLength={8}
              {...register("plate")}
              onChange={handlePlateChange}
            />
            {isFetching && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-primary-600" />
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

      {/* Grid campos */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={FORM_LABEL}>Montadora</label>
          <input className={FORM_INPUT} type="text" placeholder="Honda" {...register("make")} />
        </div>
        <div>
          <label className={FORM_LABEL}>Modelo</label>
          <input className={FORM_INPUT} type="text" placeholder="Civic" {...register("model")} />
        </div>
        <div>
          <label className={FORM_LABEL}>Versão</label>
          <input className={FORM_INPUT} type="text" placeholder="EX 2.0" {...register("vehicle_version")} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={FORM_LABEL}>Ano</label>
          <input
            className={FORM_INPUT}
            type="number"
            min={1900}
            max={2100}
            placeholder="2024"
            {...register("year", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className={FORM_LABEL}>Cor</label>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <ColorSelect value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
        </div>
        <div>
          <label className={FORM_LABEL}>Combustível</label>
          <input className={FORM_INPUT} type="text" placeholder="Flex, Gasolina..." {...register("fuel_type")} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-2">
        <div>
          <label className={FORM_LABEL}>Chassi</label>
          <input className={FORM_INPUT} type="text" maxLength={17} placeholder="17 caracteres" {...register("chassis")} />
        </div>
        <div>
          <label className={FORM_LABEL}>FIPE (R$)</label>
          <input
            className={FORM_INPUT}
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            {...register("fipe_value", { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* Hidden field para persistir make_logo */}
      <input type="hidden" {...register("make_logo")} />
    </div>
  )
}
