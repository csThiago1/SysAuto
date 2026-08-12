"use client"

import { useEffect, useState } from "react"
import { useFipeMakes, useFipeModels, useFipeYears } from "@/hooks/useVehicleFipe"
import type { VehicleMake, VehicleModel, VehicleYearVersion } from "@paddock/types"

import { FORM_INPUT } from "@paddock/utils"
import { NativeSelect } from "@/components/ui/native-select"

const SELECT = `${FORM_INPUT} disabled:cursor-not-allowed`

interface VehicleFipeFieldsProps {
  /** Valores iniciais (vindos da placa ou edição) */
  initialMake?: string
  initialModel?: string
  initialYear?: number | null
  initialVersion?: string
  initialFuelType?: string
  /** Callback quando o usuário seleciona valores */
  onFieldChange: (fields: {
    make: string
    model: string
    vehicle_version?: string
    year?: number | null
    fuel_type?: string
  }) => void
  /** Se true, mostra fallback de input livre (placa não encontrada) */
  allowFreeText?: boolean
  /** Labels customizáveis */
  labelClass?: string
}

export function VehicleFipeFields({
  initialMake,
  initialModel,
  initialYear,
  initialVersion,
  initialFuelType,
  onFieldChange,
  allowFreeText = true,
  labelClass = "block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-0.5",
}: VehicleFipeFieldsProps) {
  const [selectedMakeId, setSelectedMakeId] = useState<number | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null)
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null)
  const [freeMode, setFreeMode] = useState(false)
  const [freeMake, setFreeMake] = useState(initialMake ?? "")
  const [freeModel, setFreeModel] = useState(initialModel ?? "")

  const { data: makes = [], isLoading: makesLoading } = useFipeMakes()
  const { data: models = [], isLoading: modelsLoading } = useFipeModels(selectedMakeId)
  const { data: years = [], isLoading: yearsLoading } = useFipeYears(selectedModelId)

  // Se tem valor inicial de make, tentar casar com a lista FIPE
  useEffect(() => {
    if (!initialMake || makesLoading) return

    // Catálogo indisponível (tabela vazia / API fora): antes o efeito saía aqui
    // e a tela mostrava "Selecione..." mesmo com marca e modelo salvos na OS —
    // parecia veículo sem dados. Cai no modo livre exibindo o que está salvo.
    if (makes.length === 0) {
      setFreeMode(true)
      setFreeMake(initialMake)
      setFreeModel(initialModel ?? "")
      return
    }

    const match = makes.find(
      (m) => m.nome.toLowerCase() === initialMake.toLowerCase()
    )
    if (match) {
      setSelectedMakeId(match.id)
    } else {
      // Marca não encontrada na FIPE — modo livre
      setFreeMode(true)
      setFreeMake(initialMake)
      setFreeModel(initialModel ?? "")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makes.length, makesLoading])

  // Se tem valor inicial de model, tentar casar
  useEffect(() => {
    if (!initialModel || models.length === 0 || !selectedMakeId) return
    const match = models.find(
      (m) => m.nome.toLowerCase() === initialModel.toLowerCase()
    )
    if (match) setSelectedModelId(match.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models.length, selectedMakeId])

  // Emitir onChange quando seleções mudam
  useEffect(() => {
    if (freeMode) return
    const make = makes.find((m) => m.id === selectedMakeId)
    const model = models.find((m) => m.id === selectedModelId)
    const year = years.find((y) => y.id === selectedYearId)
    if (make) {
      onFieldChange({
        make: make.nome,
        model: model?.nome ?? "",
        vehicle_version: year?.descricao ?? "",
        year: year?.ano ?? null,
        fuel_type: year?.combustivel ?? "",
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMakeId, selectedModelId, selectedYearId])

  if (freeMode) {
    return (
      <>
        <div className="grid grid-cols-6 gap-2">
          <div className="col-span-3">
            <label className={labelClass}>Montadora *</label>
            <input
              className={SELECT}
              value={freeMake}
              onChange={(e) => {
                setFreeMake(e.target.value)
                onFieldChange({ make: e.target.value, model: freeModel })
              }}
              placeholder="Ex: Honda"
            />
          </div>
          <div className="col-span-3">
            <label className={labelClass}>Modelo *</label>
            <input
              className={SELECT}
              value={freeModel}
              onChange={(e) => {
                setFreeModel(e.target.value)
                onFieldChange({ make: freeMake, model: e.target.value })
              }}
              placeholder="Ex: Civic"
            />
          </div>
        </div>
        {allowFreeText && (
          <button
            type="button"
            onClick={() => { setFreeMode(false); setFreeMake(""); setFreeModel("") }}
            className="text-xs text-primary hover:underline"
          >
            Usar catálogo FIPE
          </button>
        )}
      </>
    )
  }

  return (
    <>
      {/* Marca */}
      <div className="grid grid-cols-6 gap-2">
        <div className="col-span-3">
          <label className={labelClass}>Montadora *</label>
          <NativeSelect
            disabled={makesLoading}
            value={selectedMakeId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null
              setSelectedMakeId(id)
              setSelectedModelId(null)
              setSelectedYearId(null)
            }}
          >
            <option value="">
              {makesLoading ? "Carregando..." : "Selecione..."}
            </option>
            {makes.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </NativeSelect>
        </div>

        {/* Modelo */}
        <div className="col-span-3">
          <label className={labelClass}>Modelo *</label>
          <NativeSelect
            disabled={!selectedMakeId || modelsLoading}
            value={selectedModelId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null
              setSelectedModelId(id)
              setSelectedYearId(null)
            }}
          >
            <option value="">
              {modelsLoading ? "Carregando..." : selectedMakeId ? "Selecione..." : "Marca primeiro"}
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Ano/Versão */}
      {selectedModelId && (
        <div>
          <label className={labelClass}>
            Ano / Versão <span className="font-normal text-muted-foreground/60">(opcional)</span>
          </label>
          <NativeSelect
            disabled={yearsLoading}
            value={selectedYearId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null
              setSelectedYearId(id)
            }}
          >
            <option value="">
              {yearsLoading ? "Carregando..." : "Selecione..."}
            </option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.ano} — {y.descricao} ({y.combustivel})
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {allowFreeText && (
        <button
          type="button"
          onClick={() => setFreeMode(true)}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          Veículo não está na lista? Preencher manualmente
        </button>
      )}
    </>
  )
}
