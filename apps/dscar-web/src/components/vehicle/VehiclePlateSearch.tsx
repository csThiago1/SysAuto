"use client"

import { useState, useEffect } from "react"
import { Search, History, Globe, X, Car, AlertCircle, CheckCircle2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useVehicleHistory, usePlateApi } from "@/hooks/useServiceOrders"

export interface VehicleData {
  plate: string
  make: string
  model: string
  year: number | null
  vehicle_version: string
  color: string
  fuel_type: string
  // pré-preenchimento de cliente (do histórico)
  last_customer_name?: string
  last_customer_uuid?: string | null
}

interface Props {
  value: VehicleData | null
  onChange: (v: VehicleData | null) => void
  /** Se true, mostra o campo de versão */
  showVersion?: boolean
}

function formatPlate(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (clean.length <= 3) return clean
  return clean.slice(0, 3) + "-" + clean.slice(3, 7)
}

export function VehiclePlateSearch({ value, onChange, showVersion = true }: Props) {
  const [plateInput, setPlateInput] = useState("")
  const [searchedPlate, setSearchedPlate] = useState("")
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState("")

  // Manual edit mode (after selecting a vehicle)
  const [editing, setEditing] = useState(false)

  const normalized = searchedPlate.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const { data: history, isFetching: historyLoading } = useVehicleHistory(normalized)
  const plateApi = usePlateApi()

  // Quando o usuário digita uma placa completa, busca automaticamente no histórico
  useEffect(() => {
    const clean = plateInput.toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (clean.length >= 7) {
      setSearchedPlate(clean)
    } else {
      setSearchedPlate("")
    }
  }, [plateInput])

  // Se história encontrada, pré-seleciona automaticamente
  useEffect(() => {
    if (history?.found && !value) {
      onChange({
        plate: history.plate ?? searchedPlate,
        make: history.make ?? "",
        model: history.model ?? "",
        year: history.year ?? null,
        vehicle_version: history.vehicle_version ?? "",
        color: history.color ?? "",
        fuel_type: history.fuel_type ?? "",
        last_customer_name: history.last_customer_name,
        last_customer_uuid: history.last_customer_uuid,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history])

  async function handleSearchApi() {
    setApiError("")
    setApiLoading(true)
    try {
      const result = await plateApi.mutateAsync(searchedPlate || plateInput.replace(/[^A-Z0-9]/gi, ""))
      onChange({
        plate: result.plate,
        make: result.make,
        model: result.model,
        year: result.year,
        vehicle_version: "",
        color: "",
        fuel_type: "",
      })
    } catch {
      setApiError("Placa não encontrada na base nacional.")
    } finally {
      setApiLoading(false)
    }
  }

  function handleClear() {
    onChange(null)
    setPlateInput("")
    setSearchedPlate("")
    setApiError("")
    setEditing(false)
  }

  // ── Estado: veículo já selecionado ──────────────────────────────────────────
  if (value && !editing) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-primary-500 shrink-0" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Veículo</span>
            {history?.found && (
              <Badge variant="outline" className="text-xs border-success-500/30 text-success-400 bg-success-400/10 flex items-center gap-1">
                <History className="h-3 w-3" />
                {history.visits} {history.visits === 1 ? "visita" : "visitas"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-white/30 hover:text-white/60 transition-colors px-2"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div>
            <p className="text-xs text-white/40">Placa</p>
            <p className="text-sm font-semibold text-white font-plate tracking-widest">{formatPlate(value.plate)}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Ano</p>
            <p className="text-sm text-white">{value.year ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Marca</p>
            <p className="text-sm text-white">{value.make || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Modelo</p>
            <p className="text-sm text-white">{value.model || "—"}</p>
          </div>
          {value.vehicle_version && (
            <div className="col-span-2">
              <p className="text-xs text-white/40">Versão</p>
              <p className="text-sm text-white">{value.vehicle_version}</p>
            </div>
          )}
          {value.color && (
            <div>
              <p className="text-xs text-white/40">Cor</p>
              <p className="text-sm text-white">{value.color}</p>
            </div>
          )}
          {value.last_customer_name && (
            <div className="col-span-2 pt-1 border-t border-white/5">
              <p className="text-xs text-white/40">Último cliente</p>
              <p className="text-sm text-white/70">{value.last_customer_name}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Estado: edição manual (após selecionado) ────────────────────────────────
  if (value && editing) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Editar Veículo</span>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-white/40 hover:text-white/70"
          >
            Concluir
          </button>
        </div>
        <VehicleForm value={value} onChange={onChange} showVersion={showVersion} />
      </div>
    )
  }

  // ── Estado: busca por placa ─────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Veículo</p>

      {/* Input de placa */}
      <div className="space-y-1.5">
        <Label className="text-white/70 text-xs">Placa</Label>
        <div className="relative">
          <Input
            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 uppercase font-plate tracking-widest text-base"
            placeholder="ABC-1234"
            value={plateInput}
            maxLength={8}
            onChange={(e) => setPlateInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
          />
          {historyLoading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 animate-pulse">
              buscando…
            </span>
          )}
        </div>
      </div>

      {/* Resultado do histórico */}
      {history && !historyLoading && (
        <>
          {history.found ? (
            <div className="rounded-md border border-success-500/20 bg-success-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-success-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">
                  Encontrado no histórico · {history.visits} {history.visits === 1 ? "visita" : "visitas"}
                </span>
                {history.last_visit && (
                  <span className="text-xs text-white/30 ml-auto">
                    última: {new Date(history.last_visit).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-white/40">Marca</span>
                <span className="text-white">{history.make}</span>
                <span className="text-white/40">Modelo</span>
                <span className="text-white">{history.model}</span>
                {history.year && (
                  <>
                    <span className="text-white/40">Ano</span>
                    <span className="text-white">{history.year}</span>
                  </>
                )}
                {history.last_customer_name && (
                  <>
                    <span className="text-white/40">Cliente</span>
                    <span className="text-white/70">{history.last_customer_name}</span>
                  </>
                )}
              </div>
              {/* Auto-selecionado, mas caso o useEffect não tenha disparado: */}
              <Button
                type="button"
                size="sm"
                className="w-full mt-1"
                onClick={() =>
                  onChange({
                    plate: history.plate ?? searchedPlate,
                    make: history.make ?? "",
                    model: history.model ?? "",
                    year: history.year ?? null,
                    vehicle_version: history.vehicle_version ?? "",
                    color: history.color ?? "",
                    fuel_type: history.fuel_type ?? "",
                    last_customer_name: history.last_customer_name,
                    last_customer_uuid: history.last_customer_uuid,
                  })
                }
              >
                Usar este veículo
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/40">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="text-xs">Placa não está no histórico.</span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1 border-white/10 text-white/60 hover:text-white"
                  onClick={handleSearchApi}
                  disabled={apiLoading}
                >
                  <Globe className="h-3.5 w-3.5 mr-1.5" />
                  {apiLoading ? "Buscando…" : "Buscar na API"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-white/60 hover:text-white"
                  onClick={() =>
                    onChange({
                      plate: searchedPlate,
                      make: "",
                      model: "",
                      year: null,
                      vehicle_version: "",
                      color: "",
                      fuel_type: "",
                    })
                  }
                >
                  Preencher manualmente
                </Button>
              </div>
              {apiError && (
                <p className="text-xs text-error-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {apiError}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Nenhuma placa digitada ainda — link para preenchimento manual */}
      {!searchedPlate && (
        <button
          type="button"
          className="text-xs text-white/30 hover:text-white/50 transition-colors"
          onClick={() =>
            onChange({
              plate: "",
              make: "",
              model: "",
              year: null,
              vehicle_version: "",
              color: "",
              fuel_type: "",
            })
          }
        >
          Não sei a placa — preencher manualmente
        </button>
      )}
    </div>
  )
}

// ── Formulário de edição manual ────────────────────────────────────────────────

function VehicleForm({
  value,
  onChange,
  showVersion,
}: {
  value: VehicleData
  onChange: (v: VehicleData) => void
  showVersion: boolean
}) {
  const set = (field: keyof VehicleData, val: string | number | null) =>
    onChange({ ...value, [field]: val })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">Placa</Label>
          <Input
            className="bg-white/5 border-white/10 text-white uppercase font-plate tracking-widest"
            value={value.plate}
            onChange={(e) => set("plate", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">Ano *</Label>
          <Input
            className="bg-white/5 border-white/10 text-white"
            type="number"
            min="1980"
            max={new Date().getFullYear() + 1}
            value={value.year ?? ""}
            onChange={(e) => set("year", e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">Marca *</Label>
          <Input
            className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
            placeholder="Ex: Toyota"
            value={value.make}
            onChange={(e) => set("make", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">Modelo *</Label>
          <Input
            className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
            placeholder="Ex: Corolla"
            value={value.model}
            onChange={(e) => set("model", e.target.value)}
          />
        </div>
      </div>
      {showVersion && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Versão</Label>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="Ex: 2.0 XEI CVT"
              value={value.vehicle_version}
              onChange={(e) => set("vehicle_version", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Cor</Label>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="Ex: Prata"
              value={value.color}
              onChange={(e) => set("color", e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
