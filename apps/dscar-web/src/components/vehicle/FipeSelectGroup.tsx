"use client"

import { useEffect, useState } from "react"
import { useFipeMakes, useFipeModels, useFipeYears } from "@/hooks/useVehicleFipe"
import { useResolverEnquadramento } from "@/hooks/useEnquadramento"
import type {
  EnquadramentoResolve,
  VehicleMake,
  VehicleModel,
  VehicleYearVersion,
} from "@paddock/types"

export interface FipeSelectGroupResolveResult extends EnquadramentoResolve {
  make: VehicleMake
  model: VehicleModel
  year: VehicleYearVersion
}

interface FipeSelectGroupProps {
  onResolve?: (result: FipeSelectGroupResolveResult) => void
}

export function FipeSelectGroup({ onResolve }: FipeSelectGroupProps) {
  const [selectedMake, setSelectedMake] = useState<VehicleMake | null>(null)
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null)
  const [selectedYear, setSelectedYear] = useState<VehicleYearVersion | null>(null)

  const { data: makes = [], isLoading: makesLoading } = useFipeMakes()
  const { data: models = [], isLoading: modelsLoading } = useFipeModels(
    selectedMake?.id ?? null,
  )
  const { data: years = [], isLoading: yearsLoading } = useFipeYears(
    selectedModel?.id ?? null,
  )

  const { data: enquadramento } = useResolverEnquadramento(
    selectedMake?.nome ?? null,
    selectedModel?.nome ?? null,
    selectedYear?.ano ?? null,
  )

  // Dispara onResolve quando todos os três estão selecionados e o enquadramento foi resolvido
  useEffect(() => {
    if (enquadramento && selectedMake && selectedModel && selectedYear) {
      onResolve?.({
        ...enquadramento,
        make: selectedMake,
        model: selectedModel,
        year: selectedYear,
      })
    }
  }, [enquadramento, selectedMake, selectedModel, selectedYear, onResolve])

  return (
    <div className="space-y-3">
      {/* Marca */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Marca</label>
        <select
          className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={makesLoading}
          value={selectedMake?.id ?? ""}
          onChange={(e) => {
            const make =
              makes.find((m) => m.id === Number(e.target.value)) ?? null
            setSelectedMake(make)
            setSelectedModel(null)
            setSelectedYear(null)
          }}
        >
          <option value="">
            {makesLoading ? "Carregando marcas..." : "Selecione a marca..."}
          </option>
          {makes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Modelo */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Modelo</label>
        <select
          className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!selectedMake || modelsLoading}
          value={selectedModel?.id ?? ""}
          onChange={(e) => {
            const model =
              models.find((m) => m.id === Number(e.target.value)) ?? null
            setSelectedModel(model)
            setSelectedYear(null)
          }}
        >
          <option value="">
            {modelsLoading
              ? "Carregando modelos..."
              : selectedMake
              ? "Selecione o modelo..."
              : "Selecione uma marca primeiro"}
          </option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Ano / Versão */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Ano / Versão</label>
        <select
          className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!selectedModel || yearsLoading}
          value={selectedYear?.id ?? ""}
          onChange={(e) => {
            const year =
              years.find((y) => y.id === Number(e.target.value)) ?? null
            setSelectedYear(year)
          }}
        >
          <option value="">
            {yearsLoading
              ? "Carregando anos..."
              : selectedModel
              ? "Selecione o ano/versão..."
              : "Selecione um modelo primeiro"}
          </option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.descricao}
            </option>
          ))}
        </select>
      </div>

      {/* Badge de perfil resolvido */}
      {enquadramento && selectedYear && (
        <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Perfil: </span>
          {enquadramento.segmento?.nome ?? enquadramento.segmento_codigo}
          {" · "}
          {enquadramento.tamanho?.nome ?? enquadramento.tamanho_codigo}
          {enquadramento.tipo_pintura_default != null &&
            ` · ${enquadramento.tipo_pintura_default.nome}`}
          <span className="ml-2 text-xs opacity-60">({enquadramento.origem})</span>
        </div>
      )}
    </div>
  )
}
