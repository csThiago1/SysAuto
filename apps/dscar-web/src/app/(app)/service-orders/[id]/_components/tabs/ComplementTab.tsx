"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import type { ServiceOrderPart, ServiceOrderLabor } from "@paddock/types"

interface Props {
  orderId: string
}

export function ComplementTab({ orderId }: Props) {
  const queryClient = useQueryClient()
  const queryKey = ["complement", orderId]

  const { data: parts = [] } = useQuery({
    queryKey: [...queryKey, "parts"],
    queryFn: () => apiFetch<ServiceOrderPart[]>(
      `/api/proxy/service-orders/${orderId}/complement/parts/`,
    ),
  })

  const { data: services = [] } = useQuery({
    queryKey: [...queryKey, "services"],
    queryFn: () => apiFetch<ServiceOrderLabor[]>(
      `/api/proxy/service-orders/${orderId}/complement/services/`,
    ),
  })

  const billMutation = useMutation({
    mutationFn: () => apiFetch(
      `/api/proxy/service-orders/${orderId}/complement/bill/`,
      { method: "POST" },
    ),
    onSuccess: (data: unknown) => {
      const result = data as { billed?: boolean; message?: string }
      if (result.billed) {
        toast.success("Complemento faturado com sucesso!")
        queryClient.invalidateQueries({ queryKey })
      } else {
        toast.info(result.message ?? "Sem itens pendentes para faturar.")
      }
    },
    onError: () => toast.error("Erro ao faturar. Tente novamente."),
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => apiFetch(
      `/api/proxy/service-orders/${orderId}/complement/items/${itemId}/`,
      { method: "DELETE" },
    ),
    onSuccess: () => {
      toast.success("Item removido.")
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error("Erro ao remover item."),
  })

  const fmtMoney = (v: number | string) =>
    parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  const allItems = [
    ...parts.map((p) => ({ ...p, kind: "part" as const })),
    ...services.map((s) => ({ ...s, kind: "service" as const })),
  ]

  const totalBilled = allItems
    .filter((i) => i.billing_status === "billed")
    .reduce((sum, i) => sum + (parseFloat(String(i.quantity)) * parseFloat(String(i.unit_price)) - parseFloat(String(i.discount))), 0)

  const totalPending = allItems
    .filter((i) => i.billing_status === "pending")
    .reduce((sum, i) => sum + (parseFloat(String(i.quantity)) * parseFloat(String(i.unit_price)) - parseFloat(String(i.discount))), 0)

  const grandTotal = totalBilled + totalPending

  const [showAddPart, setShowAddPart] = useState(false)
  const [showAddService, setShowAddService] = useState(false)

  return (
    <div className="space-y-4 py-4">
      {/* Info banner */}
      <div className="flex gap-3 rounded-lg border border-warning-500/25 bg-warning-500/5 p-3">
        <span className="text-warning-500">💰</span>
        <div>
          <div className="text-sm font-semibold text-warning-400">Itens cobrados diretamente do cliente</div>
          <div className="text-xs text-white/50">
            Serviços extras fora da cobertura da seguradora. Faturamento independente.
          </div>
        </div>
      </div>

      {/* Add buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowAddPart(!showAddPart)}
          className="inline-flex items-center gap-1.5 rounded-md border border-warning-500/40 bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-400 hover:bg-warning-500/20"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar Peça
        </button>
        <button
          type="button"
          onClick={() => setShowAddService(!showAddService)}
          className="inline-flex items-center gap-1.5 rounded-md border border-warning-500/40 bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-400 hover:bg-warning-500/20"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar Serviço
        </button>
      </div>

      {/* Inline add forms */}
      {showAddPart && (
        <ComplementAddForm
          orderId={orderId}
          kind="part"
          onClose={() => setShowAddPart(false)}
        />
      )}
      {showAddService && (
        <ComplementAddForm
          orderId={orderId}
          kind="service"
          onClose={() => setShowAddService(false)}
        />
      )}

      {/* Items table */}
      {allItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-warning-500/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warning-500/5">
                <th className="px-3 py-2 text-left font-semibold text-warning-400">Item</th>
                <th className="px-3 py-2 text-center font-semibold text-warning-400">Tipo</th>
                <th className="px-3 py-2 text-center font-semibold text-warning-400">Qtd</th>
                <th className="px-3 py-2 text-right font-semibold text-warning-400">Unit.</th>
                <th className="px-3 py-2 text-right font-semibold text-warning-400">Total</th>
                <th className="px-3 py-2 text-center font-semibold text-warning-400">Faturado</th>
                <th className="px-3 py-2 text-center font-semibold text-warning-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {allItems.map((item) => {
                const total = parseFloat(String(item.quantity)) * parseFloat(String(item.unit_price)) - parseFloat(String(item.discount))
                const isBilled = item.billing_status === "billed"
                return (
                  <tr key={item.id} className="border-t border-white/5">
                    <td className="px-3 py-2.5 text-white">{item.description}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn(
                        "rounded px-2 py-0.5 text-[11px]",
                        item.kind === "part"
                          ? "bg-info-900/50 text-info-400"
                          : "bg-warning-900/50 text-warning-400",
                      )}>
                        {item.kind === "part" ? "Peça" : "Serviço"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-white">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-white">{fmtMoney(item.unit_price)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-white">{fmtMoney(total)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn(
                        "rounded px-2 py-0.5 text-[11px]",
                        isBilled
                          ? "bg-success-500/15 text-success-500"
                          : "bg-warning-500/15 text-warning-500",
                      )}>
                        {isBilled ? "✓ Faturado" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isBilled ? (
                        <span className="text-white/20">—</span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" className="text-info-500 hover:text-info-400">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-error-500 hover:text-error-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals + bill button */}
      <div className="flex items-end justify-between">
        <div className="flex gap-3">
          <div className="rounded-lg bg-surface-800 px-4 py-3">
            <div className="text-[11px] uppercase text-white/40">Já Faturado</div>
            <div className="text-base font-bold text-success-500">{fmtMoney(totalBilled)}</div>
          </div>
          <div className="rounded-lg bg-surface-800 px-4 py-3">
            <div className="text-[11px] uppercase text-white/40">Pendente</div>
            <div className="text-base font-bold text-warning-500">{fmtMoney(totalPending)}</div>
          </div>
          <div className="rounded-lg border border-warning-500/30 bg-warning-500/10 px-4 py-3">
            <div className="text-[11px] uppercase text-warning-500">Total Complemento</div>
            <div className="text-lg font-bold text-warning-400">{fmtMoney(grandTotal)}</div>
          </div>
        </div>
        {totalPending > 0 && (
          <button
            type="button"
            disabled={billMutation.isPending}
            onClick={() => billMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-md bg-warning-600 px-4 py-2.5 text-sm font-bold text-surface-900 hover:bg-warning-500 disabled:opacity-50"
          >
            {billMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Faturar Itens Pendentes
          </button>
        )}
      </div>
    </div>
  )
}

// ── Formulário inline de adição ──────────────────────────────────
function ComplementAddForm({
  orderId,
  kind,
  onClose,
}: {
  orderId: string
  kind: "part" | "service"
  onClose: () => void
}) {
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
      <div className="flex-1">
        <label className="mb-1 block text-xs text-white/50">Descrição</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border border-white/10 bg-surface-800 px-2 py-1.5 text-sm text-white"
        />
      </div>
      <div className="w-20">
        <label className="mb-1 block text-xs text-white/50">Qtd</label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded border border-white/10 bg-surface-800 px-2 py-1.5 text-sm text-white"
        />
      </div>
      <div className="w-28">
        <label className="mb-1 block text-xs text-white/50">Valor Unit.</label>
        <input
          type="number"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className="w-full rounded border border-white/10 bg-surface-800 px-2 py-1.5 text-sm text-white"
        />
      </div>
      <button
        type="button"
        disabled={addMutation.isPending || !description || !unitPrice}
        onClick={() => addMutation.mutate()}
        className="rounded bg-warning-600 px-3 py-1.5 text-xs font-semibold text-surface-900 disabled:opacity-50"
      >
        {addMutation.isPending ? "..." : "Adicionar"}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded border border-white/15 px-3 py-1.5 text-xs text-white/60"
      >
        Cancelar
      </button>
    </div>
  )
}
