"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface ComplementAddFormProps {
  orderId: string
  kind: "part" | "service"
  onClose: () => void
}

export function ComplementAddForm({ orderId, kind, onClose }: ComplementAddFormProps) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")

  const addMutation = useMutation({
    mutationFn: () =>
      apiFetch(
        `/api/proxy/service-orders/${orderId}/complement/${kind === "part" ? "parts" : "services"}/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            quantity,
            unit_price: unitPrice,
            discount: "0.00",
          }),
        },
      ),
    onSuccess: () => {
      toast.success(`${kind === "part" ? "Peça" : "Serviço"} adicionado(a)!`)
      queryClient.invalidateQueries({ queryKey: ["complement", orderId] })
      onClose()
    },
    onError: () => toast.error("Erro ao adicionar item."),
  })

  return (
    <div className="flex items-end gap-3 rounded-lg border border-warning-500/20 bg-warning-500/5 p-3">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="comp-desc">Descrição</Label>
        <Input id="comp-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="w-20 space-y-1.5">
        <Label htmlFor="comp-qty">Qtd</Label>
        <Input id="comp-qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </div>
      <div className="w-28 space-y-1.5">
        <Label htmlFor="comp-price">Valor Unit.</Label>
        <Input id="comp-price" type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={addMutation.isPending || !description || !unitPrice}
        onClick={() => addMutation.mutate()}
      >
        {addMutation.isPending ? "..." : "Adicionar"}
      </Button>
      <Button variant="outline" size="sm" onClick={onClose}>
        Cancelar
      </Button>
    </div>
  )
}
