"use client"

import { useState } from "react"
import {
  Printer,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react"
import { useUnidades, useReservarUnidade, useBipagem } from "@/hooks/useInventory"
import { useTransferir } from "@/hooks/useInventoryMovement"
import { Button } from "@/components/ui/button"
import { BarcodeScanInput } from "@/components/inventory/BarcodeScanInput"
import { PosicaoSelector } from "@/components/inventory/PosicaoSelector"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import type { UnidadeFisicaStatus, UnidadeFisica } from "@paddock/types"
import { toast } from "sonner"
import { NativeSelect } from "@/components/ui/native-select"


/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<UnidadeFisicaStatus, string> = {
  available: "Disponivel",
  reserved: "Reservada",
  consumed: "Consumida",
  returned: "Devolvida",
  lost: "Perdida",
}

const STATUS_COLORS: Record<UnidadeFisicaStatus, string> = {
  available: "bg-success-500/10 text-success-400",
  reserved: "bg-warning-500/10 text-warning-400",
  consumed: "bg-muted/50 text-muted-foreground",
  returned: "bg-info-500/10 text-info-400",
  lost: "bg-error-500/10 text-error-400",
}

const INV = "/api/proxy/inventory"

/* ------------------------------------------------------------------ */
/*  Reservar Modal                                                     */
/* ------------------------------------------------------------------ */

function ReservarModal({
  unidade,
  onClose,
}: {
  unidade: UnidadeFisica
  onClose: () => void
}) {
  const [osId, setOsId] = useState("")
  const reservar = useReservarUnidade(unidade.id)

  async function handleSubmit() {
    if (!osId.trim()) return
    try {
      await reservar.mutateAsync({ ordem_servico_id: osId.trim() })
      toast.success("Unidade reservada com sucesso.")
      onClose()
    } catch {
      toast.error("Erro ao reservar unidade.")
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reservar Unidade</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Barcode: <span className="font-mono text-foreground/60">{unidade.codigo_barras}</span>
        </p>
        <div>
          <label className="label-mono text-muted-foreground mb-1.5 block">
            ID DA ORDEM DE SERVICO
          </label>
          <Input
            type="text"
            value={osId}
            onChange={(e) => setOsId(e.target.value)}
            placeholder="UUID da OS..."
            className="w-full font-mono"
            autoFocus
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
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!osId.trim() || reservar.isPending}
          >
            {reservar.isPending ? "Reservando..." : "Reservar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Transferir Modal                                                   */
/* ------------------------------------------------------------------ */

function TransferirModal({
  unidade,
  onClose,
}: {
  unidade: UnidadeFisica
  onClose: () => void
}) {
  const [nivelId, setNivelId] = useState<string | null>(null)
  const transferir = useTransferir()

  async function handleSubmit() {
    if (!nivelId) return
    try {
      await transferir.mutateAsync({
        item_tipo: "unidade",
        item_id: unidade.id,
        nivel_destino_id: nivelId,
      })
      toast.success("Unidade transferida com sucesso.")
      onClose()
    } catch {
      toast.error("Erro ao transferir unidade.")
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transferir Unidade</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Barcode: <span className="font-mono text-foreground/60">{unidade.codigo_barras}</span>
          {" "}| Atual: <span className="text-foreground/60">{unidade.nivel || unidade.localizacao || "Sem posicao"}</span>
        </p>
        <div>
          <label className="label-mono text-muted-foreground mb-1.5 block">
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
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!nivelId || transferir.isPending}
          >
            {transferir.isPending ? "Transferindo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function UnidadesPage() {
  const [statusFilter, setStatusFilter] = useState("")
  const [reservarUnidade, setReservarUnidade] = useState<UnidadeFisica | null>(null)
  const [transferirUnidade, setTransferirUnidade] = useState<UnidadeFisica | null>(null)

  const { data: unidades = [], isLoading } = useUnidades(
    statusFilter ? { status: statusFilter } : undefined
  )

  const bipagem = useBipagem()

  async function handleScan(code: string) {
    try {
      await bipagem.mutateAsync({
        codigo_barras: code,
        ordem_servico_id: "",
      })
      toast.success(`Bipagem registrada: ${code}`)
    } catch {
      toast.error("Codigo de barras nao encontrado.")
    }
  }

  async function handlePrintLabel(unidade: UnidadeFisica) {
    try {
      await fetch(`${INV}/unidades/${unidade.id}/imprimir-etiqueta/`, {
        method: "POST",
      })
      toast.success("Etiqueta enviada para impressao.")
    } catch {
      toast.error("Erro ao imprimir etiqueta.")
    }
  }

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="page-title">Unidades Fisicas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unidades.length} unidade{unidades.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <NativeSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          wrapperClassName="w-auto"
          className="w-auto"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </NativeSelect>
      </div>

      {/* Barcode Scanner */}
      <BarcodeScanInput
        onScan={handleScan}
        placeholder="Bipe ou digite o codigo de barras para localizar..."
        disabled={bipagem.isPending}
      />

      {/* Table */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : unidades.length === 0 ? (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhuma unidade encontrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-muted/50">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/30">
                <TableHead className="py-3">BARCODE</TableHead>
                <TableHead className="py-3">PECA</TableHead>
                <TableHead className="py-3">PRODUTO</TableHead>
                <TableHead className="py-3">POSICAO</TableHead>
                <TableHead className="py-3">STATUS</TableHead>
                <TableHead className="py-3">DATA</TableHead>
                <TableHead className="py-3 text-right">ACOES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unidades.map((u) => (
                <TableRow
                  key={u.id}
                  className="border-white/5"
                >
                  <TableCell className="font-mono text-xs text-foreground/60">
                    {u.codigo_barras}
                  </TableCell>
                  <TableCell className="text-foreground text-sm">
                    {u.peca_nome}
                  </TableCell>
                  <TableCell className="text-foreground/60 text-sm">
                    {u.produto_peca || "\u2014"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground/60">
                    {u.nivel || u.localizacao || "\u2014"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[u.status as UnidadeFisicaStatus]}`}
                    >
                      {STATUS_LABELS[u.status as UnidadeFisicaStatus]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {u.status === "available" && (
                        <button
                          type="button"
                          onClick={() => setReservarUnidade(u)}
                          title="Reservar"
                          className="p-1.5 rounded hover:bg-muted/50 text-success-400 transition-colors"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setTransferirUnidade(u)}
                        title="Transferir"
                        className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintLabel(u)}
                        title="Imprimir Etiqueta"
                        className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination info */}
      {!isLoading && unidades.length > 0 && (
        <div className="flex justify-end">
          <p className="text-xs text-muted-foreground font-mono">
            {unidades.length} registro{unidades.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Modals */}
      {reservarUnidade && (
        <ReservarModal
          unidade={reservarUnidade}
          onClose={() => setReservarUnidade(null)}
        />
      )}
      {transferirUnidade && (
        <TransferirModal
          unidade={transferirUnidade}
          onClose={() => setTransferirUnidade(null)}
        />
      )}

    </div>
  )
}
