"use client"

import React from "react"
import { ShoppingCart, Plus, Trash2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEmitNfce } from "@/hooks/useFiscal"
import { usePermission } from "@/hooks/usePermission"
import { formatCurrency } from "@paddock/utils"

const FORMA_PAGAMENTO_OPTIONS = [
  { value: "01", label: "Dinheiro" },
  { value: "03", label: "Cartão de Crédito" },
  { value: "04", label: "Cartão de Débito" },
  { value: "15", label: "PIX" },
  { value: "99", label: "Outros" },
]

interface ItemForm {
  codigo_produto: string
  descricao: string
  ncm: string
  unidade: string
  quantidade: string
  valor_unitario: string
}

const emptyItem: ItemForm = {
  codigo_produto: "",
  descricao: "",
  ncm: "",
  unidade: "UN",
  quantidade: "1",
  valor_unitario: "",
}

export default function EmitirNfcePage() {
  const canEmit = usePermission("CONSULTANT")
  const emitNfce = useEmitNfce()

  const [items, setItems] = React.useState<ItemForm[]>([{ ...emptyItem }])
  const [formaPagamento, setFormaPagamento] = React.useState("15") // PIX default
  const [cpf, setCpf] = React.useState("")
  const [nome, setNome] = React.useState("")
  const [observacoes, setObservacoes] = React.useState("")
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null)

  const updateItem = (idx: number, field: keyof ItemForm, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const addItem = () => setItems(prev => [...prev, { ...emptyItem }])

  const removeItem = (idx: number) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const total = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantidade) || 0
    const price = parseFloat(it.valor_unitario) || 0
    return sum + qty * price
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    for (const item of items) {
      if (!item.descricao) { toast.error("Descrição obrigatória em todos os itens."); return }
      if (!item.ncm || item.ncm.length < 8) { toast.error("NCM deve ter 8 dígitos."); return }
      if (!item.valor_unitario || parseFloat(item.valor_unitario) <= 0) { toast.error("Valor unitário obrigatório."); return }
    }

    try {
      const data = await emitNfce.mutateAsync({
        itens: items.map(it => ({
          codigo_produto: it.codigo_produto || undefined,
          descricao: it.descricao,
          ncm: it.ncm,
          unidade: it.unidade || "UN",
          quantidade: parseFloat(it.quantidade) || 1,
          valor_unitario: it.valor_unitario,
        })),
        forma_pagamento: formaPagamento,
        cpf_destinatario: cpf.replace(/\D/g, "") || undefined,
        nome_destinatario: nome || undefined,
        observacoes: observacoes || undefined,
      })
      setResult(data as Record<string, unknown>)
      toast.success("NFC-e emitida com sucesso!")
    } catch {
      toast.error("Erro ao emitir NFC-e.")
    }
  }

  if (!canEmit) {
    return <div className="p-6 text-muted-foreground">Sem permissão para emitir NFC-e.</div>
  }

  if (result) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="rounded-xl bg-success-500/10 border border-success-500/20 p-6 space-y-3">
          <div className="flex items-center gap-2 text-success-400">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="text-lg font-bold">NFC-e Emitida</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Ref:</span> <span className="font-mono">{String(result.ref ?? "—")}</span></div>
            <div><span className="text-muted-foreground">Status:</span> <span className="font-semibold">{String(result.status ?? "—")}</span></div>
            <div><span className="text-muted-foreground">Número:</span> {String(result.number ?? "—")}</div>
            <div><span className="text-muted-foreground">Valor:</span> {formatCurrency(result.total_value as string)}</div>
          </div>
          {typeof result.pdf_url === "string" && (
            <a href={String(result.pdf_url)} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Visualizar Cupom (PDF)
            </a>
          )}
          <Button variant="outline" size="sm" onClick={() => { setResult(null); setItems([{ ...emptyItem }]) }}>
            Emitir Outra
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Emitir NFC-e</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Cupom fiscal eletrônico ao consumidor</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Consumidor (opcional) */}
        <div className="rounded-xl bg-muted/30 border border-white/[0.07] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground/80">Consumidor (opcional)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-foreground/70">CPF</Label>
              <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label className="text-xs text-foreground/70">Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do consumidor" />
            </div>
          </div>
        </div>

        {/* Itens */}
        <div className="rounded-xl bg-muted/30 border border-white/[0.07] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground/80">Itens</h3>
            <Button type="button" variant="ghost" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_100px_100px_80px_100px_auto] gap-2 items-end">
              <div>
                <Label className="text-xs text-foreground/70">Descrição *</Label>
                <Input value={item.descricao} onChange={e => updateItem(idx, "descricao", e.target.value)} required />
              </div>
              <div>
                <Label className="text-xs text-foreground/70">NCM *</Label>
                <Input value={item.ncm} onChange={e => updateItem(idx, "ncm", e.target.value)} maxLength={8} required />
              </div>
              <div>
                <Label className="text-xs text-foreground/70">Valor *</Label>
                <Input type="number" step="0.01" min="0.01" value={item.valor_unitario} onChange={e => updateItem(idx, "valor_unitario", e.target.value)} required />
              </div>
              <div>
                <Label className="text-xs text-foreground/70">Qtd</Label>
                <Input type="number" min="1" value={item.quantidade} onChange={e => updateItem(idx, "quantidade", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-foreground/70">Unid</Label>
                <Input value={item.unidade} onChange={e => updateItem(idx, "unidade", e.target.value)} />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                <Trash2 className="h-4 w-4 text-error-400" />
              </Button>
            </div>
          ))}

          <div className="text-right text-sm font-semibold text-foreground pt-2 border-t border-border">
            Total: {formatCurrency(total)}
          </div>
        </div>

        {/* Pagamento */}
        <div className="rounded-xl bg-muted/30 border border-white/[0.07] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground/80">Pagamento</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-foreground/70">Forma de pagamento *</Label>
              <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}
                className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {FORMA_PAGAMENTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-foreground/70">Observações</Label>
              <Input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
        </div>

        {emitNfce.isError && (
          <p className="text-xs text-error-400 bg-error-500/10 rounded px-3 py-2">
            {emitNfce.error?.message || "Erro ao emitir NFC-e."}
          </p>
        )}

        <Button type="submit" disabled={emitNfce.isPending} className="w-full">
          {emitNfce.isPending ? "Emitindo..." : "Emitir NFC-e"}
        </Button>
      </form>
    </div>
  )
}
