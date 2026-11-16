"use client"

import { NativeSelect } from "@/components/ui/native-select";
import { useState } from "react"
import { FileText, Plus } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { useOrcamentos } from "@/hooks/useQuotes"
import { ORCAMENTO_STATUS_LABEL, ORCAMENTO_STATUS_BADGE } from "@paddock/utils"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

const formatBRL = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export default function OrcamentosPage() {
  const [statusFilter, setStatusFilter] = useState("")

  const { data: orcamentos = [], isLoading } = useOrcamentos(
    statusFilter ? { status: statusFilter } : undefined
  )

  const rascunhos  = orcamentos.filter((o) => o.status === "rascunho").length
  const enviados   = orcamentos.filter((o) => o.status === "enviado").length
  const aprovados  = orcamentos.filter((o) => ["aprovado", "aprovado_parc"].includes(o.status)).length
  const totalValue = orcamentos
    .filter((o) => o.status !== "recusado" && o.status !== "expirado")
    .reduce((acc, o) => acc + parseFloat(o.total), 0)

  return (
    <div className="px-0 py-3 md:p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Orçamentos</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {orcamentos.length} orçamento{orcamentos.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link
          href={"/orcamentos/novo" as Route}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm text-primary-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Orçamento
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Rascunhos",  value: rascunhos,  color: "text-muted-foreground" },
          { label: "Enviados",   value: enviados,   color: "text-info-400" },
          { label: "Aprovados",  value: aprovados,  color: "text-success-400" },
          { label: "Volume",     value: formatBRL(totalValue), color: "text-warning-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-xl font-semibold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <NativeSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-auto"
          wrapperClassName="w-auto"
        >
          <option value="">Todos os status</option>
          {Object.entries(ORCAMENTO_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </NativeSelect>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando...</div>
      ) : orcamentos.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhum orçamento encontrado.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Seguradora</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orcamentos.map((orc) => (
                <TableRow
                  key={orc.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => { window.location.href = `/orcamentos/${orc.id}` }}
                >
                  <TableCell className="text-foreground font-medium">
                    {orc.numero} <span className="text-muted-foreground text-xs">v{orc.versao}</span>
                  </TableCell>
                  <TableCell className="text-foreground/80">{orc.customer_nome}</TableCell>
                  <TableCell className="text-foreground/60">
                    {orc.veiculo_marca} {orc.veiculo_modelo} {orc.veiculo_ano}
                    {orc.veiculo_placa && (
                      <span className="ml-1 text-xs text-muted-foreground">{orc.veiculo_placa}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-foreground/60">{orc.seguradora ?? "—"}</TableCell>
                  <TableCell className="text-right text-foreground/80">{formatBRL(orc.total)}</TableCell>
                  <TableCell className="text-foreground/60">
                    {new Date(orc.validade).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ORCAMENTO_STATUS_BADGE[orc.status]}`}>
                      {ORCAMENTO_STATUS_LABEL[orc.status]}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
