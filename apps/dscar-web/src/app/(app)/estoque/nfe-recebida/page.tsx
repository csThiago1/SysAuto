"use client"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

import { useState } from "react"
import { FileText, Plus } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { useNFeEntradas } from "@/hooks/useInventory"
import { ScrollFade } from "@/components/ui/scroll-fade"
import type { NFeEntradaStatus } from "@paddock/types"
import { NativeSelect } from "@/components/ui/native-select"

const STATUS_LABELS: Record<NFeEntradaStatus, string> = {
  importada: "Importada",
  validada: "Validada",
  estoque_gerado: "Estoque Gerado",
}

const STATUS_COLORS: Record<NFeEntradaStatus, string> = {
  importada: "text-warning-400 bg-warning-500/10",
  validada: "text-info-400 bg-info-500/10",
  estoque_gerado: "text-success-400 bg-success-400/10",
}

const STATUS_STRIPE: Record<NFeEntradaStatus, string> = {
  importada: "bg-warning-500",
  validada: "bg-info-500",
  estoque_gerado: "bg-success-500",
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export default function NFeRecebidaPage() {
  const [statusFilter, setStatusFilter] = useState("")

  const { data: notas = [], isLoading } = useNFeEntradas(
    statusFilter ? { status: statusFilter } : undefined
  )

  return (
    <div className="px-0 py-3 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">NF-e de Entrada</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {notas.length} nota{notas.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : notas.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhuma NF-e encontrada.
        </div>
      ) : (
        <>
        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {notas.map((nfe) => {
            const status = nfe.status as NFeEntradaStatus
            return (
              <div
                key={nfe.id}
                onClick={() => (window.location.href = `/estoque/nfe-recebida/${nfe.id}`)}
                className="relative cursor-pointer overflow-hidden rounded-md bg-muted/30 py-2.5 pl-4 pr-3"
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-[3px] ${STATUS_STRIPE[status]}`}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {nfe.numero || "—"}
                      {nfe.serie ? ` / ${nfe.serie}` : ""}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-foreground/60">
                      {nfe.emitente_nome || "—"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_44px] gap-x-3 text-[11px] text-muted-foreground">
                  <span className="truncate">
                    {nfe.data_emissao
                      ? new Date(nfe.data_emissao).toLocaleDateString("pt-BR")
                      : "—"}
                  </span>
                  <span className="whitespace-nowrap text-right font-mono tabular-nums text-foreground/80">
                    {brl.format(parseFloat(nfe.valor_total))}
                  </span>
                  <span className="text-right font-mono tabular-nums">
                    {nfe.total_itens} it.
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block rounded-lg border border-border">
        <ScrollFade>
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/50 text-muted-foreground text-xs">
                <TableHead className="py-3">Número</TableHead>
                <TableHead className="py-3">Emitente</TableHead>
                <TableHead className="py-3">Data Emissão</TableHead>
                <TableHead className="py-3 text-right">Valor Total</TableHead>
                <TableHead className="py-3 text-right">Itens</TableHead>
                <TableHead className="py-3">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notas.map((nfe) => (
                <TableRow
                  key={nfe.id}
                  className="border-white/5 hover:bg-muted/50 cursor-pointer"
                  onClick={() => window.location.href = `/estoque/nfe-recebida/${nfe.id}`}
                >
                  <TableCell className="text-foreground font-medium">
                    {nfe.numero || "—"}{nfe.serie ? ` / ${nfe.serie}` : ""}
                  </TableCell>
                  <TableCell className="text-foreground/80">{nfe.emitente_nome || "—"}</TableCell>
                  <TableCell className="text-foreground/60">
                    {nfe.data_emissao
                      ? new Date(nfe.data_emissao).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-foreground/80">
                    {parseFloat(nfe.valor_total).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell className="text-right text-foreground/60">{nfe.total_itens}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[nfe.status as NFeEntradaStatus]}`}>
                      {STATUS_LABELS[nfe.status as NFeEntradaStatus]}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollFade>
        </div>
        </>
      )}
    </div>
  )
}
