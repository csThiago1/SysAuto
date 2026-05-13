"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { PedidoCompra } from "@paddock/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useSuppliersWithContacts, useRegistrarResposta } from "@/hooks/usePurchasing"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RespostaFormProps {
  pedidos: PedidoCompra[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PedidoRespostaState {
  valor_unitario: string
  prazo_entrega: string
  condicoes_pagamento: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RespostaForm({ pedidos, open, onOpenChange }: RespostaFormProps) {
  const [supplierId, setSupplierId] = useState("")
  const [respostas, setRespostas] = useState<Record<string, PedidoRespostaState>>(() =>
    Object.fromEntries(
      pedidos.map((p) => [
        p.id,
        { valor_unitario: "", prazo_entrega: "", condicoes_pagamento: "" },
      ]),
    ),
  )
  const [isSaving, setIsSaving] = useState(false)

  const { data: suppliers } = useSuppliersWithContacts()
  const registrarResposta = useRegistrarResposta()

  function updateResposta(
    pedidoId: string,
    field: keyof PedidoRespostaState,
    value: string,
  ) {
    setRespostas((prev) => ({
      ...prev,
      [pedidoId]: { ...prev[pedidoId], [field]: value },
    }))
  }

  async function handleSave() {
    if (!supplierId) {
      toast.warning("Selecione o fornecedor antes de salvar.")
      return
    }

    const preenchidos = pedidos.filter(
      (p) => respostas[p.id]?.valor_unitario?.trim() !== "",
    )
    if (preenchidos.length === 0) {
      toast.warning("Informe o valor para ao menos uma peca.")
      return
    }

    setIsSaving(true)
    try {
      for (const pedido of preenchidos) {
        const r = respostas[pedido.id]
        await registrarResposta.mutateAsync({
          pedido_compra: pedido.id,
          supplier: supplierId,
          valor_unitario: r.valor_unitario,
          prazo_entrega: r.prazo_entrega,
          condicoes_pagamento: r.condicoes_pagamento,
        })
      }
      toast.success(
        `${preenchidos.length} resposta(s) registrada(s) com sucesso.`,
      )
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar respostas. Tente novamente.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Resposta de Fornecedor</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Supplier selector */}
          <div className="space-y-1.5">
            <Label className="label-mono text-muted-foreground">Fornecedor</Label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione o fornecedor...</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Per-pedido price inputs */}
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_120px_120px_140px] gap-2">
              <span className="label-mono text-muted-foreground text-xs">Peca</span>
              <span className="label-mono text-muted-foreground text-xs">Valor unit.</span>
              <span className="label-mono text-muted-foreground text-xs">Prazo</span>
              <span className="label-mono text-muted-foreground text-xs">Cond. pagamento</span>
            </div>

            {pedidos.map((p) => {
              const r = respostas[p.id] ?? {
                valor_unitario: "",
                prazo_entrega: "",
                condicoes_pagamento: "",
              }
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_120px_120px_140px] gap-2 items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground/80 truncate">{p.descricao}</p>
                    {p.codigo_referencia && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {p.codigo_referencia}
                      </p>
                    )}
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="R$ 0,00"
                    value={r.valor_unitario}
                    onChange={(e) =>
                      updateResposta(p.id, "valor_unitario", e.target.value)
                    }
                    className="bg-muted/50 border-border text-foreground text-sm h-8"
                  />
                  <Input
                    type="text"
                    placeholder="Ex: 2 dias"
                    value={r.prazo_entrega}
                    onChange={(e) =>
                      updateResposta(p.id, "prazo_entrega", e.target.value)
                    }
                    className="bg-muted/50 border-border text-foreground text-sm h-8"
                  />
                  <Input
                    type="text"
                    placeholder="Ex: 30/60 dias"
                    value={r.condicoes_pagamento}
                    onChange={(e) =>
                      updateResposta(p.id, "condicoes_pagamento", e.target.value)
                    }
                    className="bg-muted/50 border-border text-foreground text-sm h-8"
                  />
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? "Salvando..." : "Salvar respostas"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
