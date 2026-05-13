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
import { useSuppliersWithContacts, useRegistrarCotacao } from "@/hooks/usePurchasing"

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuotationBuilderProps {
  pedidos: PedidoCompra[]
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

export function QuotationBuilder({ pedidos, open, onOpenChange }: QuotationBuilderProps) {
  const first = pedidos[0]

  const defaultMotor = extractMotor(
    first?.os_vehicle_version ?? "",
    first?.os_model ?? "",
    first?.os_fuel_type ?? "",
  )
  const defaultCambio = extractCambio(first?.os_vehicle_version ?? "")

  const [activePreset, setActivePreset] = useState<Preset>("concessionaria")
  const [toggles, setToggles] = useState<FieldToggles>(PRESETS.concessionaria)
  const [motor, setMotor] = useState(defaultMotor)
  const [cambio, setCambio] = useState(defaultCambio)
  const [observacoes, setObservacoes] = useState(first?.observacoes ?? "")
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)

  const { data: suppliers } = useSuppliersWithContacts()
  const registrarCotacao = useRegistrarCotacao()

  function applyPreset(preset: Preset) {
    setActivePreset(preset)
    setToggles(PRESETS[preset])
  }

  function setToggle(key: keyof FieldToggles) {
    return (value: boolean) => setToggles((prev) => ({ ...prev, [key]: value }))
  }

  function toggleSupplier(id: string, checked: boolean) {
    setSelectedSuppliers((prev) =>
      checked ? [...prev, id] : prev.filter((s) => s !== id),
    )
  }

  const previewText = useMemo(() => {
    if (!first) return ""
    const lines: string[] = ["Olá, preciso de cotação:", ""]

    const vehicleLines: string[] = []
    if (toggles.marcaModelo && (first.os_make || first.os_model)) {
      const version = toggles.versao && first.os_vehicle_version ? first.os_vehicle_version : ""
      const year = toggles.ano && first.os_year ? first.os_year : ""
      const header = [first.os_make, first.os_model, version, year]
        .filter(Boolean)
        .join(" ")
      if (header) vehicleLines.push(header)
    } else if (toggles.ano && first.os_year) {
      vehicleLines.push(first.os_year)
    }

    if (toggles.motor && motor) vehicleLines.push(`Motor: ${motor}`)
    if (toggles.cambio && cambio) vehicleLines.push(`Câmbio: ${cambio}`)
    if (toggles.combustivel && first.os_fuel_type) vehicleLines.push(`Combustível: ${first.os_fuel_type}`)
    if (toggles.placa && first.os_plate) vehicleLines.push(`Placa: ${first.os_plate}`)
    if (toggles.chassi && first.os_chassis) vehicleLines.push(`Chassi: ${first.os_chassis}`)

    if (vehicleLines.length > 0) {
      lines.push(...vehicleLines)
      lines.push("")
    }

    pedidos.forEach((p, idx) => {
      const ref = p.codigo_referencia ? ` — Ref: ${p.codigo_referencia}` : ""
      lines.push(`${idx + 1}. ${p.descricao}${ref} — Qtd: ${p.quantidade}`)
    })

    if (toggles.observacoes && observacoes) {
      lines.push("")
      lines.push(`Obs: ${observacoes}`)
    }

    lines.push("")
    lines.push("Aguardo retorno. Obrigado!")

    return lines.join("\n")
  }, [toggles, motor, cambio, observacoes, pedidos, first])

  async function handleSend(mode: "copy" | "whatsapp") {
    if (selectedSuppliers.length === 0) {
      toast.warning("Selecione ao menos um fornecedor antes de enviar.")
      return
    }

    setIsSending(true)
    try {
      for (const supplierId of selectedSuppliers) {
        const supplier = suppliers?.find((s) => s.id === supplierId)
        await registrarCotacao.mutateAsync({
          service_order: first.service_order,
          supplier: supplierId,
          supplier_contact: supplier?.contacts?.[0]?.id ?? null,
          mensagem: previewText,
          pedido_ids: pedidos.map((p) => p.id),
        })
      }

      if (mode === "copy") {
        await navigator.clipboard.writeText(previewText)
        toast.success(
          `Copiado! Cotação registrada para ${selectedSuppliers.length} fornecedor(es).`,
        )
      } else {
        const supplier = suppliers?.find((s) => s.id === selectedSuppliers[0])
        const phone = supplier?.contacts?.[0]?.phone?.replace(/\D/g, "") ?? ""
        const url = phone
          ? `https://wa.me/55${phone}?text=${encodeURIComponent(previewText)}`
          : `https://wa.me/?text=${encodeURIComponent(previewText)}`
        window.open(url, "_blank")
        toast.success("Cotação registrada!")
      }
    } catch {
      toast.error("Erro ao registrar cotação. Tente novamente.")
    } finally {
      setIsSending(false)
    }
  }

  if (!first) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Montador de Cotação WhatsApp</DialogTitle>
        </DialogHeader>

        {pedidos.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {pedidos.map((p) => (
              <span
                key={p.id}
                className="px-2 py-0.5 rounded-full text-xs bg-info-500/10 text-info-400 border border-info-500/20"
              >
                {p.descricao}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
          {/* ── Left: Controls ── */}
          <div className="space-y-4">
            {/* Presets */}
            <div>
              <p className="label-mono text-muted-foreground mb-2">Preset rapido</p>
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
                  Concessionaria
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
              <p className="label-mono text-muted-foreground mb-2">Campos do veiculo</p>
              <div className="space-y-1.5 pl-1">
                <CheckRow label="Placa" checked={toggles.placa} onChange={setToggle("placa")} />
                <CheckRow label="Chassi" checked={toggles.chassi} onChange={setToggle("chassi")} />
                <CheckRow label="Marca / Modelo" checked={toggles.marcaModelo} onChange={setToggle("marcaModelo")} />
                <CheckRow label="Ano" checked={toggles.ano} onChange={setToggle("ano")} />
                <CheckRow label="Versao" checked={toggles.versao} onChange={setToggle("versao")} />
                <CheckRow label="Motor" checked={toggles.motor} onChange={setToggle("motor")} />
                <CheckRow label="Cambio" checked={toggles.cambio} onChange={setToggle("cambio")} />
                <CheckRow label="Combustivel" checked={toggles.combustivel} onChange={setToggle("combustivel")} />
              </div>
            </div>

            {/* Motor and Cambio editable fields */}
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
                <label className="label-mono text-muted-foreground mb-1 block">Cambio</label>
                <input
                  type="text"
                  value={cambio}
                  onChange={(e) => setCambio(e.target.value)}
                  placeholder="Ex: AT, MT, CVT"
                  className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Observacoes */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckRow
                  label="Incluir observacoes"
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

            {/* Suppliers */}
            <div>
              <p className="label-mono text-muted-foreground mb-2">Fornecedores</p>
              {!suppliers?.length ? (
                <p className="text-xs text-muted-foreground/60 italic">
                  Nenhum fornecedor cadastrado
                </p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {suppliers.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-start gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSuppliers.includes(s.id)}
                        onChange={(e) => toggleSupplier(s.id, e.target.checked)}
                        className="w-3.5 h-3.5 rounded border border-border mt-0.5 accent-primary cursor-pointer flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-xs text-foreground">{s.name}</span>
                        {s.contacts?.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({s.contacts.map((c) => c.name).join(", ")})
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Preview ── */}
          <div className="flex flex-col gap-3">
            <p className="label-mono text-muted-foreground">Preview da mensagem</p>
            <pre className="flex-1 bg-muted/50 border border-border rounded-md p-3 text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed min-h-[220px]">
              {previewText}
            </pre>

            {selectedSuppliers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedSuppliers.length} fornecedor(es) selecionado(s)
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isSending}
                onClick={() => void handleSend("copy")}
              >
                <Copy size={14} />
                Copiar
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1 bg-success-600 hover:bg-success-700 text-white"
                disabled={isSending}
                onClick={() => void handleSend("whatsapp")}
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
