"use client"

import { useState } from "react"
import {
  Package,
  Printer,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react"
import { useUnidades, useReservarUnidade, useBipagem } from "@/hooks/useInventory"
import { useTransferir } from "@/hooks/useInventoryMovement"
import { BarcodeScanInput } from "@/components/inventory/BarcodeScanInput"
import { PosicaoSelector } from "@/components/inventory/PosicaoSelector"
import type { UnidadeFisicaStatus, UnidadeFisica } from "@paddock/types"
import { toast } from "sonner"

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
  consumed: "bg-white/5 text-white/40",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#1a1a1c] p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">
          Reservar Unidade
        </h3>
        <p className="text-xs text-white/40">
          Barcode: <span className="font-mono text-white/60">{unidade.codigo_barras}</span>
        </p>
        <div>
          <label className="label-mono text-white/50 mb-1 block">
            ID DA ORDEM DE SERVICO
          </label>
          <input
            type="text"
            value={osId}
            onChange={(e) => setOsId(e.target.value)}
            placeholder="UUID da OS..."
            className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm font-mono placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary-500"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!osId.trim() || reservar.isPending}
            className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {reservar.isPending ? "Reservando..." : "Reservar"}
          </button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-[#1a1a1c] p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">
          Transferir Unidade
        </h3>
        <p className="text-xs text-white/40">
          Barcode: <span className="font-mono text-white/60">{unidade.codigo_barras}</span>
          {" "}| Atual: <span className="text-white/60">{unidade.nivel || unidade.localizacao || "Sem posicao"}</span>
        </p>
        <div>
          <label className="label-mono text-white/50 mb-1 block">
            DESTINO
          </label>
          <PosicaoSelector value={nivelId} onChange={setNivelId} />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!nivelId || transferir.isPending}
            className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {transferir.isPending ? "Transferindo..." : "Transferir"}
          </button>
        </div>
      </div>
    </div>
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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Unidades Fisicas</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {unidades.length} unidade{unidades.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Barcode Scanner */}
      <BarcodeScanInput
        onScan={handleScan}
        placeholder="Bipe ou digite o codigo de barras para localizar..."
        disabled={bipagem.isPending}
      />

      {/* Table */}
      {isLoading ? (
        <div className="text-white/40 text-sm">Carregando...</div>
      ) : unidades.length === 0 ? (
        <div className="overflow-hidden rounded-md border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma unidade encontrada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-3 text-left label-mono text-white/40">BARCODE</th>
                <th className="px-4 py-3 text-left label-mono text-white/40">PECA</th>
                <th className="px-4 py-3 text-left label-mono text-white/40">PRODUTO</th>
                <th className="px-4 py-3 text-left label-mono text-white/40">POSICAO</th>
                <th className="px-4 py-3 text-left label-mono text-white/40">STATUS</th>
                <th className="px-4 py-3 text-left label-mono text-white/40">DATA</th>
                <th className="px-4 py-3 text-right label-mono text-white/40">ACOES</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-white/60">
                    {u.codigo_barras}
                  </td>
                  <td className="px-4 py-3 text-white text-sm">
                    {u.peca_nome}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-sm">
                    {u.produto_peca || "\u2014"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/60">
                    {u.nivel || u.localizacao || "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[u.status as UnidadeFisicaStatus]}`}
                    >
                      {STATUS_LABELS[u.status as UnidadeFisicaStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white/40">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {u.status === "available" && (
                        <button
                          type="button"
                          onClick={() => setReservarUnidade(u)}
                          title="Reservar"
                          className="p-1.5 rounded hover:bg-white/[0.06] text-success-400 transition-colors"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setTransferirUnidade(u)}
                        title="Transferir"
                        className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintLabel(u)}
                        title="Imprimir Etiqueta"
                        className="p-1.5 rounded hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination info */}
      {!isLoading && unidades.length > 0 && (
        <div className="flex justify-end">
          <p className="text-xs text-white/30 font-mono">
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
