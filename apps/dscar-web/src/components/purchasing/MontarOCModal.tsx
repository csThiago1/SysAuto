"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { PedidoCompra } from "@paddock/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  useCreateOrdemCompra,
  useAddItemOC,
  useOrdensCompraByOS,
} from "@/hooks/usePurchasing"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MontarOCModalProps {
  pedido: PedidoCompra
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MontarOCModal({ pedido, open, onOpenChange }: MontarOCModalProps) {
  const [fornecedorNome, setFornecedorNome] = useState("")
  const [fornecedorCnpj, setFornecedorCnpj] = useState("")
  const [fornecedorContato, setFornecedorContato] = useState("")
  const [valorUnitario, setValorUnitario] = useState("")
  const [prazoEntrega, setPrazoEntrega] = useState("")
  const [observacoes, setObservacoes] = useState("")

  const { data: ordensExistentes } = useOrdensCompraByOS(
    open ? pedido.service_order : undefined,
  )
  const createOC = useCreateOrdemCompra()
  const addItem = useAddItemOC()

  const ocExistente = ordensExistentes?.[0]
  const isSubmitting = createOC.isPending || addItem.isPending

  function handleClose() {
    if (isSubmitting) return
    setFornecedorNome("")
    setFornecedorCnpj("")
    setFornecedorContato("")
    setValorUnitario("")
    setPrazoEntrega("")
    setObservacoes("")
    onOpenChange(false)
  }

  async function handleSubmit() {
    if (!fornecedorNome.trim() || !valorUnitario.trim()) {
      toast.error("Preencha o fornecedor e o preço unitário.")
      return
    }

    const valorNum = parseFloat(valorUnitario.replace(",", "."))
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.error("Preço unitário inválido.")
      return
    }

    try {
      let ocId: string
      let ocNumero: string

      if (ocExistente) {
        ocId = ocExistente.id
        ocNumero = ocExistente.numero
      } else {
        const novaOC = await createOC.mutateAsync({
          service_order: pedido.service_order,
        })
        ocId = novaOC.id
        ocNumero = novaOC.numero
      }

      await addItem.mutateAsync({
        ocId,
        pedido_compra_id: pedido.id,
        fornecedor_nome: fornecedorNome.trim(),
        fornecedor_cnpj: fornecedorCnpj.trim() || undefined,
        fornecedor_contato: fornecedorContato.trim() || undefined,
        descricao: pedido.descricao,
        codigo_referencia: pedido.codigo_referencia || undefined,
        tipo_qualidade: pedido.tipo_qualidade,
        quantidade: pedido.quantidade,
        valor_unitario: valorNum.toFixed(2),
        prazo_entrega: prazoEntrega.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      })

      toast.success(`Item adicionado à OC ${ocNumero}`)
      handleClose()
    } catch {
      toast.error("Erro ao salvar. Tente novamente.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Montar Ordem de Compra</DialogTitle>
        </DialogHeader>

        {/* Context info */}
        <div className="bg-muted/50 border border-border rounded-md px-3 py-2 space-y-0.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{pedido.descricao}</span>
            {pedido.codigo_referencia && (
              <span className="ml-1.5 font-mono">({pedido.codigo_referencia})</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Qtd: {pedido.quantidade}
            {pedido.veiculo && <span className="ml-2">· {pedido.veiculo}</span>}
          </p>
          {ocExistente && (
            <p className="text-xs text-info-400 mt-1">
              OC {ocExistente.numero} já existe — item será adicionado a ela.
            </p>
          )}
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block">Fornecedor *</Label>
            <Input
              value={fornecedorNome}
              onChange={(e) => setFornecedorNome(e.target.value)}
              placeholder="Nome da loja / distribuidora"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">CNPJ do fornecedor</Label>
              <Input
                value={fornecedorCnpj}
                onChange={(e) => setFornecedorCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label className="mb-1 block">Contato / WhatsApp</Label>
              <Input
                value={fornecedorContato}
                onChange={(e) => setFornecedorContato(e.target.value)}
                placeholder="(92) 99000-0000"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Preço unitário *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  R$
                </span>
                <Input
                  value={valorUnitario}
                  onChange={(e) => setValorUnitario(e.target.value)}
                  placeholder="0,00"
                  className="pl-8"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Prazo de entrega</Label>
              <Input
                value={prazoEntrega}
                onChange={(e) => setPrazoEntrega(e.target.value)}
                placeholder="Ex: 3 dias úteis"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <Label className="mb-1 block">Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre o fornecedor ou item..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !fornecedorNome.trim() || !valorUnitario.trim()}
          >
            {isSubmitting ? "Salvando..." : "Adicionar à OC"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
