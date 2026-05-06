"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, ShoppingCart, Plus, Trash2, Send } from "lucide-react"
import { toast } from "sonner"
import type { TipoQualidade, AdicionarItemOCInput } from "@paddock/types"
import { formatCurrency } from "@paddock/utils"
import {
  useOrdemCompra,
  useAdicionarItemOC,
  useRemoverItemOC,
  useEnviarOC,
  useAprovarOC,
  useRejeitarOC,
} from "@/hooks/usePurchasing"
import { OrdemCompraDetail } from "@/components/purchasing/OrdemCompraDetail"
import { TipoQualidadeBadge } from "@/components/purchasing/TipoQualidadeBadge"

// ─── Add Item Form ────────────────────────────────────────────────────────────

const INITIAL_FORM: AdicionarItemOCInput = {
  fornecedor_nome: "",
  fornecedor_cnpj: "",
  fornecedor_contato: "",
  descricao: "",
  codigo_referencia: "",
  tipo_qualidade: "reposicao",
  quantidade: "1",
  valor_unitario: "",
  prazo_entrega: "",
  observacoes: "",
}

function AddItemForm({
  ocId,
  onAdded,
}: {
  ocId: string
  onAdded: () => void
}) {
  const [form, setForm] = useState<AdicionarItemOCInput>({ ...INITIAL_FORM })
  const mutation = useAdicionarItemOC(ocId)

  function update(field: keyof AdicionarItemOCInput, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(): Promise<void> {
    if (!form.descricao.trim() || !form.fornecedor_nome.trim() || !form.valor_unitario) {
      toast.error("Preencha descricao, fornecedor e valor unitario.")
      return
    }
    try {
      await mutation.mutateAsync(form)
      setForm({ ...INITIAL_FORM })
      toast.success("Item adicionado.")
      onAdded()
    } catch {
      toast.error("Erro ao adicionar item. Tente novamente.")
    }
  }

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-4">
      <p className="label-mono text-muted-foreground">ADICIONAR ITEM</p>

      <div className="grid grid-cols-3 gap-3">
        {/* Fornecedor nome */}
        <div className="space-y-1">
          <label className="label-mono text-muted-foreground">FORNECEDOR</label>
          <input
            type="text"
            value={form.fornecedor_nome}
            onChange={(e) => update("fornecedor_nome", e.target.value)}
            placeholder="Nome do fornecedor"
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:border-border"
          />
        </div>

        {/* Descricao */}
        <div className="space-y-1">
          <label className="label-mono text-muted-foreground">DESCRICAO</label>
          <input
            type="text"
            value={form.descricao}
            onChange={(e) => update("descricao", e.target.value)}
            placeholder="Descricao da peca"
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:border-border"
          />
        </div>

        {/* Tipo qualidade */}
        <div className="space-y-1">
          <label className="label-mono text-muted-foreground">TIPO</label>
          <select
            value={form.tipo_qualidade}
            onChange={(e) => update("tipo_qualidade", e.target.value as TipoQualidade)}
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 focus:outline-none focus:border-border"
          >
            <option value="genuina">Genuina</option>
            <option value="reposicao">Reposicao</option>
            <option value="similar">Similar</option>
            <option value="usada">Usada</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {/* Quantidade */}
        <div className="space-y-1">
          <label className="label-mono text-muted-foreground">QTD</label>
          <input
            type="number"
            min="1"
            value={form.quantidade}
            onChange={(e) => update("quantidade", e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:border-border"
          />
        </div>

        {/* Valor unitario */}
        <div className="space-y-1">
          <label className="label-mono text-muted-foreground">VALOR UNIT</label>
          <input
            type="text"
            value={form.valor_unitario}
            onChange={(e) => update("valor_unitario", e.target.value)}
            placeholder="0.00"
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:border-border"
          />
        </div>

        {/* Prazo entrega */}
        <div className="space-y-1">
          <label className="label-mono text-muted-foreground">PRAZO</label>
          <input
            type="text"
            value={form.prazo_entrega ?? ""}
            onChange={(e) => update("prazo_entrega", e.target.value)}
            placeholder="Ex: 3 dias"
            className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none focus:border-border"
          />
        </div>

        {/* Submit */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={mutation.isPending}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                       bg-primary-500/15 text-primary-400 border border-primary-500/20
                       hover:bg-primary-500/25 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            {mutation.isPending ? "Adicionando..." : "Adicionar Item"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Draft Items Table (with remove) ──────────────────────────────────────────

function DraftItemsManager({ ocId }: { ocId: string }) {
  const { data: oc } = useOrdemCompra(ocId)
  const [removingId, setRemovingId] = useState<string | null>(null)

  if (!oc?.itens?.length) return null

  return (
    <div className="space-y-2">
      <div className="section-divider">ITENS NO RASCUNHO</div>
      <div className="bg-muted/50 rounded-md border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="label-mono text-muted-foreground text-left px-4 py-2.5">DESCRICAO</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-2.5">FORNECEDOR</th>
              <th className="label-mono text-muted-foreground text-left px-4 py-2.5">TIPO</th>
              <th className="label-mono text-muted-foreground text-right px-4 py-2.5">QTD</th>
              <th className="label-mono text-muted-foreground text-right px-4 py-2.5">UNIT</th>
              <th className="label-mono text-muted-foreground text-right px-4 py-2.5">TOTAL</th>
              <th className="label-mono text-muted-foreground text-center px-4 py-2.5">ACAO</th>
            </tr>
          </thead>
          <tbody>
            {oc.itens.map((item) => (
              <DraftItemRow
                key={item.id}
                item={item}
                ocId={ocId}
                isRemoving={removingId === item.id}
                onRemoveStart={() => setRemovingId(item.id)}
                onRemoveEnd={() => setRemovingId(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DraftItemRow({
  item,
  ocId,
  isRemoving,
  onRemoveStart,
  onRemoveEnd,
}: {
  item: import("@paddock/types").ItemOrdemCompra
  ocId: string
  isRemoving: boolean
  onRemoveStart: () => void
  onRemoveEnd: () => void
}) {
  const removeMutation = useRemoverItemOC(ocId, item.id)

  async function handleRemove(): Promise<void> {
    onRemoveStart()
    try {
      await removeMutation.mutateAsync()
      toast.success("Item removido.")
    } catch {
      toast.error("Erro ao remover item.")
    } finally {
      onRemoveEnd()
    }
  }

  return (
    <tr
      className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
        isRemoving ? "opacity-50" : ""
      }`}
    >
      <td className="px-4 py-2.5">
        <span className="text-sm text-foreground/70">{item.descricao}</span>
        {item.codigo_referencia && (
          <span className="ml-1.5 text-xs text-muted-foreground font-mono">
            {item.codigo_referencia}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className="text-sm text-muted-foreground">{item.fornecedor_nome || "--"}</span>
      </td>
      <td className="px-4 py-2.5">
        <TipoQualidadeBadge tipo={item.tipo_qualidade} />
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="text-sm font-mono text-foreground/60">{item.quantidade}</span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="text-sm font-mono text-foreground/60">
          {formatCurrency(item.valor_unitario)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="text-sm font-mono font-bold text-foreground">
          {formatCurrency(item.valor_total)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-center">
        <button
          type="button"
          onClick={() => void handleRemove()}
          disabled={isRemoving}
          className="p-1 rounded text-muted-foreground/50 hover:text-error-400 hover:bg-error-500/10 transition-colors disabled:opacity-50"
          title="Remover item"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdemCompraPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: oc, isLoading, refetch } = useOrdemCompra(id)
  const enviarMutation = useEnviarOC(id)
  const aprovarMutation = useAprovarOC(id)
  const rejeitarMutation = useRejeitarOC(id)

  async function handleEnviar(): Promise<void> {
    try {
      await enviarMutation.mutateAsync()
      toast.success("OC enviada para aprovacao.")
    } catch {
      toast.error("Erro ao enviar OC. Tente novamente.")
    }
  }

  async function handleAprovar(): Promise<void> {
    try {
      await aprovarMutation.mutateAsync()
      toast.success("Ordem de compra aprovada.")
    } catch {
      toast.error("Erro ao aprovar OC. Tente novamente.")
    }
  }

  async function handleRejeitar(motivo: string): Promise<void> {
    try {
      await rejeitarMutation.mutateAsync({ motivo })
      toast.success("Ordem de compra rejeitada.")
    } catch {
      toast.error("Erro ao rejeitar OC. Tente novamente.")
    }
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-6 bg-muted/50 rounded w-64 animate-pulse" />
        <div className="h-40 bg-muted/50 rounded-lg animate-pulse" />
        <div className="h-60 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!oc) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Ordem de compra nao encontrada.</p>
      </div>
    )
  }

  const isDraft = oc.status === "rascunho"

  return (
    <div className="p-6 space-y-6">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/compras" className="hover:text-muted-foreground transition-colors">
          Compras
        </Link>
        <ChevronRight size={14} />
        <Link
          href="/compras"
          className="hover:text-muted-foreground transition-colors"
        >
          Ordens de Compra
        </Link>
        <ChevronRight size={14} />
        <span className="text-foreground/60 font-mono">{oc.numero}</span>
      </nav>

      {/* ── OC Detail ── */}
      <OrdemCompraDetail
        oc={oc}
        onAprovar={() => void handleAprovar()}
        onRejeitar={(motivo) => void handleRejeitar(motivo)}
        isApproving={aprovarMutation.isPending}
        isRejecting={rejeitarMutation.isPending}
      />

      {/* ── Draft mode: add items + send ── */}
      {isDraft && (
        <>
          <AddItemForm ocId={id} onAdded={() => void refetch()} />
          <DraftItemsManager ocId={id} />

          {/* Send for approval */}
          {(oc.total_itens ?? 0) > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleEnviar()}
                disabled={enviarMutation.isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold
                           bg-primary-500/15 text-primary-400 border border-primary-500/20
                           hover:bg-primary-500/25 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                {enviarMutation.isPending
                  ? "Enviando..."
                  : "Enviar para Aprovacao"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
