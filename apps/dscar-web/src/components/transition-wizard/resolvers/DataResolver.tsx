"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api"
import type { ResolverProps } from "./index"

async function patchOrder(id: string, data: Record<string, unknown>): Promise<void> {
  await apiFetch(`/api/proxy/service-orders/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

function VehicleDataForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [plate, setPlate] = useState(order.plate ?? "")
  const [make, setMake] = useState(order.make ?? "")
  const [model, setModel] = useState(order.model ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    if (!plate || !make || !model) {
      toast.error("Preencha placa, montadora e modelo")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { plate, make, model })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar dados do veículo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div>
        <label htmlFor="dv-plate" className="text-xs font-medium">Placa</label>
        <input
          id="dv-plate"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          placeholder="ABC1234"
          maxLength={8}
        />
      </div>
      <div>
        <label htmlFor="dv-make" className="text-xs font-medium">Montadora</label>
        <input
          id="dv-make"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={make}
          onChange={(e) => setMake(e.target.value)}
          placeholder="Fiat"
        />
      </div>
      <div>
        <label htmlFor="dv-model" className="text-xs font-medium">Modelo</label>
        <input
          id="dv-model"
          className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Uno"
        />
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
    if (isNaN(val) || val < 0) {
      toast.error("KM inválido")
      return
    }
    setSaving(true)
    try {
      await patchOrder(order.id, { mileage_out: val })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
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

export function DataResolver(props: ResolverProps) {
  if (props.block.code === "VEHICLE_BASIC_DATA") return <VehicleDataForm {...props} />
  if (props.block.code === "CUSTOMER_TYPE_SET") return <CustomerTypeForm {...props} />
  if (props.block.code === "MILEAGE_OUT") return <MileageOutForm {...props} />
  return null
}
