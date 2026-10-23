"use client"

import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import { usePersonSearch } from "@/app/(app)/os/[numero]/_hooks/useCustomerSearch"
import { toLocalDatetime } from "@/app/(app)/os/[numero]/_utils/form-defaults"
import type { ResolverProps } from "./index"
import { DateField } from "@/components/ui/date-field"
import { formatPlate, onlyAlnum } from "@paddock/utils"
import { ColorSelect } from "@/app/(app)/os/[numero]/_components/shared/ColorSelect"
import { VehicleCatalogPicker } from "@/components/vehicle/VehicleCatalogPicker"
import type { CatalogSelection } from "@/components/vehicle/catalog.schema"

async function patchOrder(id: string, data: Record<string, unknown>): Promise<void> {
  await apiFetch(`/api/proxy/service-orders/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

/** Veículo pelo seletor do catálogo: ano e combustível vêm da versão (snapshot do servidor). */
function VehicleDataForm({ block, order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const needsPlate = block.code === "VEHICLE_BASIC_DATA"
  const [plate, setPlate] = useState(order.plate ?? "")
  const [selection, setSelection] = useState<CatalogSelection | null>(order.catalog_path ?? null)
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (needsPlate && !plate) {
      toast.error("Preencha a placa")
      return
    }
    if (!selection?.family) {
      toast.error("Escolha a montadora e o modelo")
      return
    }
    const payload: Record<string, unknown> = {
      ...(needsPlate && { plate }),
      catalog_family: selection.family.id,
      catalog_version: selection.version?.id ?? null,
    }

    setSaving(true)
    try {
      await patchOrder(order.id, payload)
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar dados do veículo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {needsPlate && (
        <div>
          <label htmlFor="dv-plate" className="text-xs font-medium">Placa</label>
          <input
            id="dv-plate"
            className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={formatPlate(plate)}
            onChange={(e) => setPlate(onlyAlnum(e.target.value))}
            placeholder="ABC-1D23"
            maxLength={8}
          />
        </div>
      )}
      <VehicleCatalogPicker value={selection} onChange={setSelection} disabled={saving} />
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function VehicleColorForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [color, setColor] = useState(order.color ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (!color || color === "NAO_INFORMADA") {
      toast.error("Informe a cor do veículo")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { color })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar dados do veículo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="space-y-0.5">
        <span className="text-xs font-medium">Cor</span>
        <ColorSelect value={color} onChange={setColor} />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function CustomerTypeForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)

  async function handleSelect(type: "private" | "insurer"): Promise<void> {
    setSaving(true)
    try {
      await patchOrder(order.id, { customer_type: type })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao definir tipo de OS")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex gap-2">
      <Button
        size="sm"
        variant={order.customer_type === "private" ? "default" : "outline"}
        disabled={saving}
        onClick={() => void handleSelect("private")}
      >
        Particular
      </Button>
      <Button
        size="sm"
        variant={order.customer_type === "insurer" ? "default" : "outline"}
        disabled={saving}
        onClick={() => void handleSelect("insurer")}
      >
        Seguradora
      </Button>
    </div>
  )
}

function MileageOutForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [km, setKm] = useState(order.mileage_out?.toString() ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    const val = parseInt(km, 10)
    if (isNaN(val) || val <= 0) {
      toast.error("KM inválido")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { mileage_out: val })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar KM de saída")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-mileage-out" className="text-xs font-medium">KM de Saída</label>
        <input
          id="dv-mileage-out"
          type="number"
          min="0"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="45000"
        />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function MileageInForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [km, setKm] = useState(order.mileage_in?.toString() ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    const val = parseInt(km, 10)
    if (isNaN(val) || val < 0) { toast.error("KM inválido"); return }
    setSaving(true)
    try {
      await patchOrder(order.id, { mileage_in: val })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar KM de entrada")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-mileage-in" className="text-xs font-medium">KM de Entrada</label>
        <input
          id="dv-mileage-in"
          type="number"
          min="0"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="45000"
        />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function CustomerLinkedForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [q, setQ] = useState("")
  const [saving, setSaving] = useState(false)
  const { data: searchResult, isFetching } = usePersonSearch(q)

  async function handleSelect(personId: number, name: string): Promise<void> {
    setSaving(true)
    try {
      await patchOrder(order.id, { customer_person_id: personId, customer_name: name })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao vincular cliente")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          className="w-full rounded-md border bg-background pl-7 pr-2 py-1.5 text-sm"
          placeholder="Buscar cliente por nome..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {searchResult && searchResult.results.length > 0 && (
        <ul className="rounded-md border divide-y max-h-40 overflow-y-auto">
          {searchResult.results.map((p) => (
            <li key={p.id}>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                disabled={saving}
                onClick={() => void handleSelect(p.id, p.name)}
              >
                <span className="font-medium">{p.name}</span>
                {p.phone_masked && (
                  <span className="ml-2 text-xs text-muted-foreground">{p.phone_masked}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.length >= 2 && !isFetching && searchResult?.results.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
      )}
    </div>
  )
}

function DeductibleSetForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [val, setVal] = useState(order.deductible_amount ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    const parsed = parseFloat(val.toString().replace(",", "."))
    if (isNaN(parsed) || parsed <= 0) {
      toast.error("Valor inválido")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { deductible_amount: parsed.toFixed(2) })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar franquia")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-deductible" className="text-xs font-medium">Valor da Franquia (R$)</label>
        <input
          id="dv-deductible"
          type="number"
          min="0"
          step="0.01"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={val.toString()}
          onChange={(e) => setVal(e.target.value)}
          placeholder="1500.00"
        />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function CasualtyNumberForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [val, setVal] = useState(order.casualty_number ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    const trimmed = val.trim()
    if (!trimmed) {
      toast.error("Informe o número do sinistro")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { casualty_number: trimmed })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar número do sinistro")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-casualty" className="text-xs font-medium">Número do Sinistro</label>
        <input
          id="dv-casualty"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="SIN-12345"
        />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function AuthDateForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [val, setVal] = useState(toLocalDatetime(order.authorization_date) ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (!val) {
      toast.error("Informe a data de autorização")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { authorization_date: val })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar data de autorização")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-auth-date" className="text-xs font-medium">Data de Autorização</label>
        <DateField id="dv-auth-date" withTime value={val} onChange={setVal} />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

function EntryDateForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [val, setVal] = useState(toLocalDatetime(order.entry_date) ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (!val) {
      toast.error("Informe a data de entrada")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { entry_date: val })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar data de entrada")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="dv-entry-date" className="text-xs font-medium">Data de Entrada</label>
        <DateField id="dv-entry-date" withTime value={val} onChange={setVal} />
      </div>
      <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
        Salvar
      </Button>
    </div>
  )
}

export function DataResolver(props: ResolverProps) {
  const code = props.block.code
  if (code === "VEHICLE_BASIC_DATA" || code === "VEHICLE_YEAR" || code === "FUEL_TYPE") {
    return <VehicleDataForm {...props} />
  }
  if (code === "VEHICLE_COLOR") return <VehicleColorForm {...props} />
  if (code === "CUSTOMER_TYPE_SET") return <CustomerTypeForm {...props} />
  if (code === "MILEAGE_OUT") return <MileageOutForm {...props} />
  if (code === "MILEAGE_IN") return <MileageInForm {...props} />
  if (code === "CUSTOMER_LINKED") return <CustomerLinkedForm {...props} />
  if (code === "DEDUCTIBLE_SET") return <DeductibleSetForm {...props} />
  if (code === "CASUALTY_NUMBER") return <CasualtyNumberForm {...props} />
  if (code === "AUTH_DATE_SET") return <AuthDateForm {...props} />
  if (code === "ENTRY_DATE_SET") return <EntryDateForm {...props} />
  return null
}
