"use client"

/**
 * NF-e Recebidas — Lista de NF-e de entrada (dados locais + sync Focus)
 *
 * Mostra NFeEntrada do banco local (importadas manualmente ou via webhook).
 * Botão "Sincronizar" busca novas NF-e na Focus e importa automaticamente.
 */

import { useState } from "react"
import {
  Inbox,
  RefreshCw,
  Download,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Eye,
  FileDown,
  FileText,
  CloudDownload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { apiFetch, fetchList } from "@/lib/api"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import {
  useNfeRecebidaManifest,
  useNfeRecebidaFileUrl,
} from "@/hooks/useFiscal"
import { usePermission } from "@/hooks/usePermission"
import { formatDate, formatCurrency } from "@paddock/utils"
import { NFE_ENTRADA_STATUS_LABEL, NFE_ENTRADA_STATUS_BADGE } from "@paddock/utils"
import { cn } from "@/lib/utils"

const FISCAL = "/api/proxy/fiscal"

// ─── Types ───────────────────────────────────────────────────────────────────

interface NFeEntradaItem {
  id: string
  numero_item: number
  descricao_original: string
  quantidade: string
  valor_total_com_tributos: string
}

interface NFeEntradaLocal {
  id: string
  chave_acesso: string
  numero: string
  serie: string
  emitente_cnpj: string
  emitente_nome: string
  data_emissao: string | null
  valor_total: string
  status: string
  auto_imported: boolean
  estoque_gerado: boolean
  created_at: string
  itens?: NFeEntradaItem[]
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useNfeEntradas(statusFilter = "") {
  const params = statusFilter ? `?status=${statusFilter}` : ""
  return useQuery({
    queryKey: ["nfe-entrada", statusFilter],
    queryFn: () => fetchList<NFeEntradaLocal>(`${FISCAL}/nfe-entrada/${params}`),
  })
}

function useSyncFocus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ status: string; checked: number; imported: number }>(
        `${FISCAL}/nfe-recebidas/sync/`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["nfe-entrada"] })
      if (data.imported > 0) {
        toast.success(`${data.imported} nova(s) NF-e importada(s) da Focus.`)
      } else {
        toast.info("Nenhuma NF-e nova encontrada na Focus.")
      }
    },
    onError: () => toast.error("Erro ao sincronizar com Focus."),
  })
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function NfeEntradaRow({ nfe }: { nfe: NFeEntradaLocal }) {
  const cnpjFmt = (cnpj: string) =>
    cnpj.length === 14
      ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      : cnpj

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4">
        <p className="text-xs text-foreground/80 font-medium">{nfe.emitente_nome || "—"}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          {nfe.emitente_cnpj ? cnpjFmt(nfe.emitente_cnpj) : "—"}
        </p>
      </td>

      <td className="py-3 px-4 text-xs text-foreground/60">
        {nfe.numero}/{nfe.serie}
      </td>

      <td
        className="py-3 px-4 text-xs font-mono text-muted-foreground max-w-[140px] truncate"
        title={nfe.chave_acesso}
      >
        {nfe.chave_acesso
          ? `${nfe.chave_acesso.slice(0, 10)}…${nfe.chave_acesso.slice(-6)}`
          : "—"}
      </td>

      <td className="py-3 px-4 text-xs text-foreground/80 text-right tabular-nums">
        {formatCurrency(nfe.valor_total)}
      </td>

      <td className="py-3 px-4 text-xs text-muted-foreground">
        {formatDate(nfe.data_emissao)}
      </td>

      <td className="py-3 px-4">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            NFE_ENTRADA_STATUS_BADGE[nfe.status] ?? ""
          )}
        >
          {NFE_ENTRADA_STATUS_LABEL[nfe.status] ?? nfe.status}
        </span>
        {nfe.auto_imported && (
          <span className="ml-1.5 text-[10px] text-blue-400/60" title="Importada automaticamente via webhook">
            auto
          </span>
        )}
      </td>

      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2">
          {nfe.chave_acesso && (
            <>
              <a
                href={`${FISCAL}/nfe-recebidas/${nfe.chave_acesso}/file/xml/`}
                target="_blank"
                rel="noopener noreferrer"
                title="Baixar XML"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                XML
              </a>
              <a
                href={`${FISCAL}/nfe-recebidas/${nfe.chave_acesso}/file/danfe/`}
                target="_blank"
                rel="noopener noreferrer"
                title="Visualizar DANFE"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" />
                DANFE
              </a>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NfeRecebidasPage() {
  const [statusFilter, setStatusFilter] = useState("")
  const { data: nfes = [], isLoading } = useNfeEntradas(statusFilter)
  const syncFocus = useSyncFocus()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">NF-e Recebidas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              NF-e de entrada (compras de pecas e insumos)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncFocus.mutate()}
            disabled={syncFocus.isPending}
            className="text-muted-foreground hover:text-foreground"
          >
            <CloudDownload className="h-4 w-4 mr-1.5" />
            {syncFocus.isPending ? "Sincronizando..." : "Sincronizar Focus"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Todos os status</option>
          <option value="importada">Importada</option>
          <option value="validada">Validada</option>
          <option value="estoque_gerado">Estoque Gerado</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-muted/30 border border-white/[0.07] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Emitente", "Num/Serie", "Chave", "Valor", "Emissao", "Status", ""].map((h) => (
                <th
                  key={h}
                  className={cn(
                    "py-2.5 px-4 text-xs font-semibold text-muted-foreground text-left",
                    h === "Valor" && "text-right"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : nfes.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                  Nenhuma NF-e de entrada encontrada.
                  <br />
                  <button
                    onClick={() => syncFocus.mutate()}
                    className="mt-2 underline text-primary/70 hover:text-primary"
                  >
                    Sincronizar com Focus
                  </button>
                </td>
              </tr>
            ) : (
              nfes.map((nfe) => <NfeEntradaRow key={nfe.id} nfe={nfe} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="text-xs text-muted-foreground">
        {nfes.length} NF-e de entrada
      </div>
    </div>
  )
}
