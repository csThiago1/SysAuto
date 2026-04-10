"use client"

import { useEffect, useState } from "react"
import { type UseFormReturn } from "react-hook-form"
import { usePlateLookup } from "../../_hooks/useVehicleCatalog"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { ColorSelect } from "../shared/ColorSelect"
import { Controller } from "react-hook-form"
import { toast } from "sonner"

const SECTION_TITLE = "text-xs font-semibold uppercase tracking-widest text-[#ea0e03]"
const LABEL = "block text-xs font-medium text-gray-600 mb-1"
const INPUT = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"

interface VehicleSectionProps {
  form: UseFormReturn<ServiceOrderUpdateInput>
}

export function VehicleSection({ form }: VehicleSectionProps) {
  const { register, control, setValue, watch, formState: { errors } } = form
  const [plateQuery, setPlateQuery] = useState("")
  const { data: plateData, isFetching, error } = usePlateLookup(plateQuery)

  function handlePlateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    setValue("plate", v)
    if (v.length >= 7) setPlateQuery(v)
  }

  // Preenche campos do veículo quando a API de placa retorna dados
  useEffect(() => {
    if (!plateData || !plateQuery || isFetching) return
    const currentMake = watch("make")
    if (!currentMake && plateData.make) {
      setValue("make", plateData.make)
      setValue("model", plateData.model)
      if (plateData.year) setValue("year", plateData.year)
      if (plateData.chassis) setValue("chassis", plateData.chassis)
      toast.success("Dados do veículo preenchidos pela placa!")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateData, isFetching])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 border-b pb-2">
        <span className={SECTION_TITLE}>Dados do Veículo</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Placa */}
        <div>
          <label className={LABEL}>Placa *</label>
          <div className="flex gap-2">
            <input
              className={INPUT}
              type="text"
              placeholder="ABC1D23"
              maxLength={8}
              {...register("plate")}
              onChange={handlePlateChange}
            />
            {isFetching && (
              <div className="flex items-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#ea0e03]" />
              </div>
            )}
          </div>
          {errors.plate && (
            <p className="mt-1 text-xs text-red-600">{errors.plate.message}</p>
          )}
          {error && (
            <p className="mt-1 text-xs text-amber-600">Placa não encontrada — preencha manualmente</p>
          )}
        </div>

        {/* Marca */}
        <div>
          <label className={LABEL}>Marca</label>
          <input className={INPUT} type="text" placeholder="Ex: Honda" {...register("make")} />
        </div>

        {/* Modelo */}
        <div>
          <label className={LABEL}>Modelo</label>
          <input className={INPUT} type="text" placeholder="Ex: Civic" {...register("model")} />
        </div>

        {/* Ano */}
        <div>
          <label className={LABEL}>Ano</label>
          <input
            className={INPUT}
            type="number"
            min={1900}
            max={2100}
            placeholder="2024"
            {...register("year", { valueAsNumber: true })}
          />
        </div>

        {/* Cor */}
        <div className="sm:col-span-2">
          <label className={LABEL}>Cor</label>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <ColorSelect value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
        </div>

        {/* Combustível */}
        <div>
          <label className={LABEL}>Combustível</label>
          <input className={INPUT} type="text" placeholder="Flex, Gasolina..." {...register("fuel_type")} />
        </div>

        {/* Chassi */}
        <div>
          <label className={LABEL}>Chassi</label>
          <input className={INPUT} type="text" maxLength={17} placeholder="17 caracteres" {...register("chassis")} />
        </div>

        {/* Valor FIPE */}
        <div>
          <label className={LABEL}>Valor FIPE</label>
          <input
            className={INPUT}
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            {...register("fipe_value", { valueAsNumber: true })}
          />
        </div>

        {/* KM entrada */}
        <div>
          <label className={LABEL}>KM entrada</label>
          <input
            className={INPUT}
            type="number"
            min="0"
            placeholder="0"
            {...register("mileage_in", { valueAsNumber: true })}
          />
        </div>
      </div>
    </div>
  )
}
