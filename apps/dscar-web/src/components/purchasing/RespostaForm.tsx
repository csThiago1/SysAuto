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
import {
  useSuppliersWithContacts,
  useRegistrarResposta,
  usePrazosEntrega,
  useCondicoesPagamento,
  useCreatePrazo,
  useCreateCondicao,
} from "@/hooks/usePurchasing"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RespostaFormProps {
  pedidos: PedidoCompra[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PedidoRespostaState {
  valor_unitario: string
  prazo_entrega_obj: string
  condicao_pagamento_obj: string
}

const CRIAR_NOVO = "__criar_novo__"

// ─── Inline criar opção ───────────────────────────────────────────────────────

function CriarPrazoInline({ onCreated }: { onCreated: (id: string) => void }) {
  const [label, setLabel] = useState("")
  const [dias, setDias] = useState("")
  const createPrazo = useCreatePrazo()

  async function handleCreate() {
    const diasNum = parseInt(dias, 10)
    if (!label.trim() || isNaN(diasNum) || diasNum < 0) {
      toast.warning("Informe o nome e a quantidade de dias úteis.")
      return
    }
    try {
      const novo = await createPrazo.mutateAsync({ label: label.trim(), dias_uteis: diasNum })
      onCreated(novo.id)
      setLabel("")
      setDias("")
    } catch {
      toast.error("Erro ao criar prazo. Tente novamente.")
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Input
        type="text"
        placeholder="Ex: 4 dias úteis"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="bg-muted/50 border-border text-foreground text-xs h-7 flex-1"
      />
      <Input
        type="number"
        placeholder="Dias"
        min="0"
        value={dias}
        onChange={(e) => setDias(e.target.value)}
        className="bg-muted/50 border-border text-foreground text-xs h-7 w-16"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs px-2"
        disabled={createPrazo.isPending}
        onClick={() => void handleCreate()}
      >
        {createPrazo.isPending ? "..." : "Criar"}
      </Button>
    </div>
  )
}

function CriarCondicaoInline({ onCreated }: { onCreated: (id: string) => void }) {
  const [label, setLabel] = useState("")
  const createCondicao = useCreateCondicao()

  async function handleCreate() {
    if (!label.trim()) {
      toast.warning("Informe o nome da condição de pagamento.")
      return
    }
    try {
      const nova = await createCondicao.mutateAsync({ label: label.trim() })
      onCreated(nova.id)
      setLabel("")
    } catch {
      toast.error("Erro ao criar condição. Tente novamente.")
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Input
        type="text"
        placeholder="Ex: Nota 45/60 dias"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="bg-muted/50 border-border text-foreground text-xs h-7 flex-1"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs px-2"
        disabled={createCondicao.isPending}
        onClick={() => void handleCreate()}
      >
        {createCondicao.isPending ? "..." : "Criar"}
      </Button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RespostaForm({ pedidos, open, onOpenChange }: RespostaFormProps) {
  const [supplierId, setSupplierId] = useState("")
  const [respostas, setRespostas] = useState<Record<string, PedidoRespostaState>>(() =>
    Object.fromEntries(
      pedidos.map((p) => [
        p.id,
        { valor_unitario: "", prazo_entrega_obj: "", condicao_pagamento_obj: "" },
      ]),
    ),
  )
  const [showNovoPrazo, setShowNovoPrazo] = useState<Record<string, boolean>>({})
  const [showNovaCondicao, setShowNovaCondicao] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)

  const { data: suppliers } = useSuppliersWithContacts()
  const { data: prazos } = usePrazosEntrega()
  const { data: condicoes } = useCondicoesPagamento()
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

  function handlePrazoChange(pedidoId: string, value: string) {
    if (value === CRIAR_NOVO) {
      setShowNovoPrazo((prev) => ({ ...prev, [pedidoId]: true }))
      updateResposta(pedidoId, "prazo_entrega_obj", "")
    } else {
      setShowNovoPrazo((prev) => ({ ...prev, [pedidoId]: false }))
      updateResposta(pedidoId, "prazo_entrega_obj", value)
    }
  }

  function handleCondicaoChange(pedidoId: string, value: string) {
    if (value === CRIAR_NOVO) {
      setShowNovaCondicao((prev) => ({ ...prev, [pedidoId]: true }))
      updateResposta(pedidoId, "condicao_pagamento_obj", "")
    } else {
      setShowNovaCondicao((prev) => ({ ...prev, [pedidoId]: false }))
      updateResposta(pedidoId, "condicao_pagamento_obj", value)
    }
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
      toast.warning("Informe o valor para ao menos uma peça.")
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
          ...(r.prazo_entrega_obj
            ? { prazo_entrega_obj: r.prazo_entrega_obj }
            : { prazo_entrega: r.prazo_entrega ?? "" }),
          ...(r.condicao_pagamento_obj
            ? { condicao_pagamento_obj: r.condicao_pagamento_obj }
            : { condicoes_pagamento: r.condicoes_pagamento ?? "" }),
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
            <div className="grid grid-cols-[1fr_110px_1fr_1fr] gap-2">
              <span className="label-mono text-muted-foreground text-xs">Peça</span>
              <span className="label-mono text-muted-foreground text-xs">Valor unit.</span>
              <span className="label-mono text-muted-foreground text-xs">Prazo de entrega</span>
              <span className="label-mono text-muted-foreground text-xs">Condição de pagamento</span>
            </div>

            {pedidos.map((p) => {
              const r = respostas[p.id] ?? {
                valor_unitario: "",
                prazo_entrega_obj: "",
                condicao_pagamento_obj: "",
              }
              const prazoSelectVal = showNovoPrazo[p.id]
                ? CRIAR_NOVO
                : (r.prazo_entrega_obj || "")
              const condicaoSelectVal = showNovaCondicao[p.id]
                ? CRIAR_NOVO
                : (r.condicao_pagamento_obj || "")

              return (
                <div key={p.id} className="space-y-1">
                  <div className="grid grid-cols-[1fr_110px_1fr_1fr] gap-2 items-start">
                    <div className="min-w-0 pt-1.5">
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

                    <div>
                      <select
                        value={prazoSelectVal}
                        onChange={(e) => handlePrazoChange(p.id, e.target.value)}
                        className="w-full bg-muted/50 border border-border text-foreground rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring h-8"
                      >
                        <option value="">Selecionar prazo...</option>
                        {prazos?.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.label}
                          </option>
                        ))}
                        <option value={CRIAR_NOVO}>+ Criar novo...</option>
                      </select>
                      {showNovoPrazo[p.id] && (
                        <CriarPrazoInline
                          onCreated={(id) => {
                            setShowNovoPrazo((prev) => ({ ...prev, [p.id]: false }))
                            updateResposta(p.id, "prazo_entrega_obj", id)
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <select
                        value={condicaoSelectVal}
                        onChange={(e) => handleCondicaoChange(p.id, e.target.value)}
                        className="w-full bg-muted/50 border border-border text-foreground rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring h-8"
                      >
                        <option value="">Selecionar condição...</option>
                        {condicoes?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                        <option value={CRIAR_NOVO}>+ Criar nova...</option>
                      </select>
                      {showNovaCondicao[p.id] && (
                        <CriarCondicaoInline
                          onCreated={(id) => {
                            setShowNovaCondicao((prev) => ({ ...prev, [p.id]: false }))
                            updateResposta(p.id, "condicao_pagamento_obj", id)
                          }}
                        />
                      )}
                    </div>
                  </div>
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
