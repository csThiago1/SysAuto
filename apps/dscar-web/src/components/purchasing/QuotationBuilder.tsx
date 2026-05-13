"use client"

import { useState, useMemo } from "react"
import { Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import type { PedidoCompra } from "@paddock/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuotationBuilderProps {
  pedido: PedidoCompra
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Preset = "concessionaria" | "independente"

interface FieldToggles {
  placa: boolean
  chassi: boolean
  marcaModelo: boolean
  ano: boolean
  versao: boolean
  motor: boolean
  cambio: boolean
  combustivel: boolean
  observacoes: boolean
}

// ─── Preset config ────────────────────────────────────────────────────────────

const PRESETS: Record<Preset, FieldToggles> = {
  concessionaria: {
    placa: true,
    chassi: true,
    marcaModelo: true,
    ano: true,
    versao: true,
    motor: true,
    cambio: true,
    combustivel: true,
    observacoes: true,
  },
  independente: {
    placa: false,
    chassi: false,
    marcaModelo: true,
    ano: true,
    versao: true,
    motor: true,
    cambio: false,
    combustivel: false,
    observacoes: true,
  },
}

// ─── Regex helpers ────────────────────────────────────────────────────────────

function extractMotor(version: string, model: string, fuelType: string): string {
  const source = `${version} ${model}`
  const match = source.match(/(\d\.\d\s*T?i?)/i)
  const enginePart = match ? match[1].trim() : ""
  if (!enginePart) return fuelType || ""
  return fuelType ? `${enginePart} ${fuelType}` : enginePart
}

function extractCambio(version: string): string {
  const match = version.match(/\b(AT|MT|CVT|AUT|Auto|Manual)\b/i)
  return match ? match[1].toUpperCase() : ""
}

// ─── Checkbox row ─────────────────────────────────────────────────────────────

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border border-border bg-muted/50 accent-primary cursor-pointer"
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </label>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuotationBuilder({ pedido, open, onOpenChange }: QuotationBuilderProps) {
  const defaultMotor = extractMotor(
    pedido.os_vehicle_version,
    pedido.os_model,
    pedido.os_fuel_type,
  )
  const defaultCambio = extractCambio(pedido.os_vehicle_version)

  const [activePreset, setActivePreset] = useState<Preset>("concessionaria")
  const [toggles, setToggles] = useState<FieldToggles>(PRESETS.concessionaria)
  const [motor, setMotor] = useState(defaultMotor)
  const [cambio, setCambio] = useState(defaultCambio)
  const [observacoes, setObservacoes] = useState(pedido.observacoes ?? "")

  function applyPreset(preset: Preset) {
    setActivePreset(preset)
    setToggles(PRESETS[preset])
  }

  function setToggle(key: keyof FieldToggles) {
    return (value: boolean) => setToggles((prev) => ({ ...prev, [key]: value }))
  }

  const previewText = useMemo(() => {
    const lines: string[] = ["Olá, preciso de cotação:", ""]

    const vehicleLines: string[] = []
    if (toggles.marcaModelo && (pedido.os_make || pedido.os_model)) {
      const version = toggles.versao && pedido.os_vehicle_version ? pedido.os_vehicle_version : ""
      const year = toggles.ano && pedido.os_year ? pedido.os_year : ""
      const header = [pedido.os_make, pedido.os_model, version, year]
        .filter(Boolean)
        .join(" ")
      if (header) vehicleLines.push(header)
    } else if (toggles.ano && pedido.os_year) {
      vehicleLines.push(pedido.os_year)
    }

    if (toggles.motor && motor) vehicleLines.push(`Motor: ${motor}`)
    if (toggles.cambio && cambio) vehicleLines.push(`Câmbio: ${cambio}`)
    if (toggles.combustivel && pedido.os_fuel_type) vehicleLines.push(`Combustível: ${pedido.os_fuel_type}`)
    if (toggles.placa && pedido.os_plate) vehicleLines.push(`Placa: ${pedido.os_plate}`)
    if (toggles.chassi && pedido.os_chassis) vehicleLines.push(`Chassi: ${pedido.os_chassis}`)

    if (vehicleLines.length > 0) {
      lines.push(...vehicleLines)
      lines.push("")
    }

    lines.push(pedido.descricao)
    if (pedido.codigo_referencia) lines.push(`Ref: ${pedido.codigo_referencia}`)
    lines.push(`Qtd: ${pedido.quantidade}`)

    if (toggles.observacoes && observacoes) {
      lines.push("")
      lines.push(`Obs: ${observacoes}`)
    }

    lines.push("")
    lines.push("Aguardo retorno. Obrigado!")

    return lines.join("\n")
  }, [toggles, motor, cambio, observacoes, pedido])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(previewText)
      toast.success("Copiado!")
    } catch {
      toast.error("Erro ao copiar. Tente manualmente.")
    }
  }

  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(previewText)}`, "_blank")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Montador de Cotação WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
          {/* ── Left: Controls ── */}
          <div className="space-y-4">
            {/* Presets */}
            <div>
              <p className="label-mono text-muted-foreground mb-2">Preset rápido</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset("concessionaria")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    activePreset === "concessionaria"
                      ? "bg-info-500/20 border-info-500/40 text-info-400"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Concessionária
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("independente")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    activePreset === "independente"
                      ? "bg-info-500/20 border-info-500/40 text-info-400"
                      : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Loja independente
                </button>
              </div>
            </div>

            {/* Vehicle field toggles */}
            <div>
              <p className="label-mono text-muted-foreground mb-2">Campos do veículo</p>
              <div className="space-y-1.5 pl-1">
                <CheckRow label="Placa" checked={toggles.placa} onChange={setToggle("placa")} />
                <CheckRow label="Chassi" checked={toggles.chassi} onChange={setToggle("chassi")} />
                <CheckRow label="Marca / Modelo" checked={toggles.marcaModelo} onChange={setToggle("marcaModelo")} />
                <CheckRow label="Ano" checked={toggles.ano} onChange={setToggle("ano")} />
                <CheckRow label="Versão" checked={toggles.versao} onChange={setToggle("versao")} />
                <CheckRow label="Motor" checked={toggles.motor} onChange={setToggle("motor")} />
                <CheckRow label="Câmbio" checked={toggles.cambio} onChange={setToggle("cambio")} />
                <CheckRow label="Combustível" checked={toggles.combustivel} onChange={setToggle("combustivel")} />
              </div>
            </div>

            {/* Motor and Câmbio editable fields */}
            <div className="space-y-3">
              <div>
                <label className="label-mono text-muted-foreground mb-1 block">Motor</label>
                <input
                  type="text"
                  value={motor}
                  onChange={(e) => setMotor(e.target.value)}
                  placeholder="Ex: 1.0 Flex, 2.0 Turbo"
                  className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="label-mono text-muted-foreground mb-1 block">Câmbio</label>
                <input
                  type="text"
                  value={cambio}
                  onChange={(e) => setCambio(e.target.value)}
                  placeholder="Ex: AT, MT, CVT"
                  className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckRow
                  label="Incluir observações"
                  checked={toggles.observacoes}
                  onChange={setToggle("observacoes")}
                />
              </div>
              {toggles.observacoes && (
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Lado direito, sem sensor de estacionamento"
                  rows={3}
                  className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              )}
            </div>
          </div>

          {/* ── Right: Preview ── */}
          <div className="flex flex-col gap-3">
            <p className="label-mono text-muted-foreground">Preview da mensagem</p>
            <pre className="flex-1 bg-muted/50 border border-border rounded-md p-3 text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed min-h-[220px]">
              {previewText}
            </pre>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCopy}
              >
                <Copy size={14} />
                Copiar
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1 bg-success-600 hover:bg-success-700 text-white"
                onClick={handleWhatsApp}
              >
                <ExternalLink size={14} />
                Abrir WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
