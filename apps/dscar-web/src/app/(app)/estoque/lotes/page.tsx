"use client"

import { useMemo, useState } from "react"
import { Layers, Printer, ArrowRightLeft, ArrowDownToLine } from "lucide-react"
import { useLotes, useBaixarInsumo } from "@/hooks/useInventory"
import { useTransferir } from "@/hooks/useInventoryMovement"
import { PosicaoSelector } from "@/components/inventory/PosicaoSelector"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { LoteInsumo } from "@paddock/types"
import { toast } from "sonner"

const INV = "/api/proxy/inventory"

/* ------------------------------------------------------------------ */
/*  Custo Medio Summary                                                */
/* ------------------------------------------------------------------ */

interface CustoMedioEntry {
  material: string
  custoMedio: number
  totalSaldo: number
  unidade: string
  loteCount: number
}

function calcularCustosMedios(lotes: LoteInsumo[]): CustoMedioEntry[] {
  const map = new Map<
    string,
    { material: string; totalValor: number; totalSaldo: number; unidade: string; count: number }
  >()

  for (const lote of lotes) {
    const saldo = parseFloat(lote.saldo)
    const custo = parseFloat(lote.valor_unitario_base)
    if (saldo <= 0) continue

    const existing = map.get(lote.material_canonico_id)
    if (existing) {
      existing.totalValor += saldo * custo
      existing.totalSaldo += saldo
      existing.count++
    } else {
      map.set(lote.material_canonico_id, {
        material: lote.material_nome,
        totalValor: saldo * custo,
        totalSaldo: saldo,
        unidade: lote.unidade_base,
        count: 1,
      })
    }
  }

  return Array.from(map.values())
    .filter((e) => e.count > 1)
    .map((e) => ({
      material: e.material,
      custoMedio: e.totalSaldo > 0 ? e.totalValor / e.totalSaldo : 0,
      totalSaldo: e.totalSaldo,
      unidade: e.unidade,
      loteCount: e.count,
    }))
}

/* ------------------------------------------------------------------ */
/*  Baixar Modal                                                       */
/* ------------------------------------------------------------------ */

function BaixarModal({
  lote,
  onClose,
}: {
  lote: LoteInsumo
  onClose: () => void
}) {
  const [osId, setOsId] = useState("")
  const [quantidade, setQuantidade] = useState("")
  const baixar = useBaixarInsumo()

  async function handleSubmit() {
    if (!osId.trim() || !quantidade.trim()) return
    try {
      await baixar.mutateAsync({
        material_canonico_id: lote.material_canonico_id,
        quantidade_base: quantidade.trim(),
        ordem_servico_id: osId.trim(),
      })
      toast.success("Baixa registrada com sucesso.")
      onClose()
    } catch {
      toast.error("Erro ao registrar baixa.")
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Baixar Insumo</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {lote.material_nome}{" "}
          <span className="font-mono text-foreground/60">
            (saldo: {lote.saldo} {lote.unidade_base})
          </span>
        </p>
        <div>
          <label className="label-mono text-muted-foreground mb-1 block">
            ID DA ORDEM DE SERVICO
          </label>
          <input
            type="text"
            value={osId}
            onChange={(e) => setOsId(e.target.value)}
            placeholder="UUID da OS..."
            className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        </div>
        <div>
          <label className="label-mono text-muted-foreground mb-1 block">
            QUANTIDADE ({lote.unidade_base})
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={lote.saldo}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder={`Max: ${lote.saldo}`}
            className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!osId.trim() || !quantidade.trim() || baixar.isPending}
            className="px-4 py-1.5 text-xs font-medium text-foreground bg-primary hover:bg-primary/90 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {baixar.isPending ? "Baixando..." : "Baixar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Transferir Modal                                                   */
/* ------------------------------------------------------------------ */

function TransferirLoteModal({
  lote,
  onClose,
}: {
  lote: LoteInsumo
  onClose: () => void
}) {
  const [nivelId, setNivelId] = useState<string | null>(null)
  const transferir = useTransferir()

  async function handleSubmit() {
    if (!nivelId) return
    try {
      await transferir.mutateAsync({
        item_tipo: "lote",
        item_id: lote.id,
        nivel_destino_id: nivelId,
      })
      toast.success("Lote transferido com sucesso.")
      onClose()
    } catch {
      toast.error("Erro ao transferir lote.")
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transferir Lote</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {lote.material_nome}{" "}
          <span className="font-mono text-foreground/60">{lote.codigo_barras}</span>
          {" "}| Atual: <span className="text-foreground/60">{lote.nivel || lote.localizacao || "Sem posicao"}</span>
        </p>
        <div>
          <label className="label-mono text-muted-foreground mb-1 block">
            DESTINO
          </label>
          <PosicaoSelector value={nivelId} onChange={setNivelId} />
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!nivelId || transferir.isPending}
            className="px-4 py-1.5 text-xs font-medium text-foreground bg-primary hover:bg-primary/90 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {transferir.isPending ? "Transferindo..." : "Transferir"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LotesPage() {
  const [apenasComSaldo, setApenasComSaldo] = useState(false)
  const [baixarLote, setBaixarLote] = useState<LoteInsumo | null>(null)
  const [transferirLote, setTransferirLote] = useState<LoteInsumo | null>(null)

  const { data: lotes = [], isLoading } = useLotes(
    apenasComSaldo ? { saldo_gt: "0" } : undefined
  )

  const custosMedios = useMemo(() => calcularCustosMedios(lotes), [lotes])

  async function handlePrintLabel(lote: LoteInsumo) {
    try {
      await fetch(`${INV}/lotes/${lote.id}/imprimir-etiqueta/`, {
        method: "POST",
      })
      toast.success("Etiqueta enviada para impressao.")
    } catch {
      toast.error("Erro ao imprimir etiqueta.")
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Lotes de Insumo</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lotes.length} lote{lotes.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-foreground/60 cursor-pointer">
          <input
            type="checkbox"
            checked={apenasComSaldo}
            onChange={(e) => setApenasComSaldo(e.target.checked)}
            className="rounded border-border bg-muted/50"
          />
          Apenas com saldo
        </label>
      </div>

      {/* Custo Medio Summary Cards */}
      {custosMedios.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {custosMedios.map((cm) => (
            <div
              key={cm.material}
              className="rounded-md border border-border bg-muted/30 p-3"
            >
              <p className="text-xs text-foreground/60 truncate">{cm.material}</p>
              <p className="text-lg font-mono text-foreground mt-1">
                R$ {cm.custoMedio.toFixed(4)}
                <span className="text-xs text-muted-foreground ml-1">/{cm.unidade}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cm.loteCount} lotes | {cm.totalSaldo.toFixed(2)} {cm.unidade} em estoque
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : lotes.length === 0 ? (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhum lote encontrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left label-mono text-muted-foreground">BARCODE</th>
                <th className="px-4 py-3 text-left label-mono text-muted-foreground">MATERIAL</th>
                <th className="px-4 py-3 text-left label-mono text-muted-foreground">PRODUTO</th>
                <th className="px-4 py-3 text-left label-mono text-muted-foreground">SALDO / CUSTO</th>
                <th className="px-4 py-3 text-left label-mono text-muted-foreground">% RESTANTE</th>
                <th className="px-4 py-3 text-left label-mono text-muted-foreground">POSICAO</th>
                <th className="px-4 py-3 text-left label-mono text-muted-foreground">VALIDADE</th>
                <th className="px-4 py-3 text-right label-mono text-muted-foreground">ACOES</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((lote) => {
                const saldo = parseFloat(lote.saldo)
                const custo = parseFloat(lote.valor_unitario_base)
                const dataLote = new Date(lote.created_at).toLocaleDateString("pt-BR")

                return (
                  <tr
                    key={lote.id}
                    className="border-b border-white/5 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground/60">
                      {lote.codigo_barras}
                    </td>
                    <td className="px-4 py-3 text-foreground text-sm">
                      {lote.material_nome}
                    </td>
                    <td className="px-4 py-3 text-foreground/60 text-sm">
                      {lote.produto_insumo || "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="font-mono text-xs text-foreground/80">
                          {saldo.toFixed(2)} {lote.unidade_base} a R$ {custo.toFixed(4)}/{lote.unidade_base}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          lote de {dataLote}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              lote.saldo_percentual > 50
                                ? "bg-success-500"
                                : lote.saldo_percentual > 20
                                ? "bg-warning-500"
                                : "bg-error-500"
                            }`}
                            style={{
                              width: `${Math.min(lote.saldo_percentual, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-xs text-muted-foreground w-10 text-right">
                          {lote.saldo_percentual}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground/60">
                      {lote.nivel || lote.localizacao || "\u2014"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {lote.validade
                        ? new Date(lote.validade).toLocaleDateString("pt-BR")
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {saldo > 0 && (
                          <button
                            type="button"
                            onClick={() => setBaixarLote(lote)}
                            title="Baixar"
                            className="p-1.5 rounded hover:bg-muted/50 text-warning-400 transition-colors"
                          >
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setTransferirLote(lote)}
                          title="Transferir"
                          className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintLabel(lote)}
                          title="Imprimir Etiqueta"
                          className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination info */}
      {!isLoading && lotes.length > 0 && (
        <div className="flex justify-end">
          <p className="text-xs text-muted-foreground font-mono">
            {lotes.length} registro{lotes.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Modals */}
      {baixarLote && (
        <BaixarModal lote={baixarLote} onClose={() => setBaixarLote(null)} />
      )}
      {transferirLote && (
        <TransferirLoteModal
          lote={transferirLote}
          onClose={() => setTransferirLote(null)}
        />
      )}
    </div>
  )
}
