"use client"

import { useState } from "react"
import { ReceiptText, Plus, Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { TableSkeleton } from "@/components/ui/table-skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBudgets } from "@/hooks/useBudgets"
import type { BudgetVersionStatus } from "@paddock/types"

const STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft:      "Rascunho",
  sent:       "Enviado",
  approved:   "Aprovado",
  rejected:   "Rejeitado",
  expired:    "Expirado",
  revision:   "Em Revisão",
  superseded: "Superado",
}

const STATUS_COLORS: Record<BudgetVersionStatus, string> = {
  draft:      "text-muted-foreground bg-muted",
  sent:       "text-info-400 bg-info-400/10",
  approved:   "text-success-400 bg-success-400/10",
  rejected:   "text-error-400 bg-error-400/10",
  expired:    "text-warning-400 bg-warning-400/10",
  revision:   "text-warning-400 bg-warning-400/10",
  superseded: "text-muted-foreground bg-muted/50",
}

const formatBRL = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR")

export default function OrcamentosParticularesPage() {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch]             = useState("")

  const filters: Record<string, string> = {}
  if (statusFilter) filters.status = statusFilter

  const { data: budgets = [], isLoading } = useBudgets(
    Object.keys(filters).length ? filters : undefined
  )

  const filtered = search.trim()
    ? budgets.filter((b) =>
        b.number.toLowerCase().includes(search.toLowerCase()) ||
        b.vehicle_plate.toLowerCase().includes(search.toLowerCase()) ||
        b.customer_name.toLowerCase().includes(search.toLowerCase())
      )
    : budgets

  const total     = budgets.length
  const rascunhos = budgets.filter((b) => b.active_version?.status === "draft").length
  const enviados  = budgets.filter((b) => b.active_version?.status === "sent").length
  const aprovados = budgets.filter((b) => b.active_version?.status === "approved").length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ReceiptText className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Orçamentos Particulares</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {total} orçamento{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link href={"/orcamentos-particulares/novo" as Route}>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Orçamento
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total",     value: total,     color: "text-foreground" },
          { label: "Rascunhos", value: rascunhos, color: "text-foreground/60" },
          { label: "Enviados",  value: enviados,  color: "text-info-400" },
          { label: "Aprovados", value: aprovados, color: "text-success-400" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-muted/50 border border-border p-4"
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Número, placa, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-muted/50 border-border text-foreground">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <TableSkeleton columns={6} />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Número</TableHead>
                <TableHead className="text-muted-foreground">Cliente</TableHead>
                <TableHead className="text-muted-foreground">Placa</TableHead>
                <TableHead className="text-muted-foreground">Versão</TableHead>
                <TableHead className="text-muted-foreground">Valor Líquido</TableHead>
                <TableHead className="text-muted-foreground">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    Nenhum orçamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow
                    key={b.id}
                    className="border-white/5 hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/orcamentos-particulares/${b.id}` as Route)}
                  >
                    <TableCell className="font-mono text-foreground text-sm">{b.number}</TableCell>
                    <TableCell className="text-foreground/80">{b.customer_name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs bg-muted text-foreground px-2 py-0.5 rounded">
                        {b.vehicle_make_logo && (
                          <img src={b.vehicle_make_logo} alt={b.vehicle_make ?? ""} className="h-3.5 w-3.5 object-contain" />
                        )}
                        {b.vehicle_plate}
                      </span>
                    </TableCell>
                    <TableCell>
                      {b.active_version ? (
                        <Badge
                          className={`text-xs border-0 ${STATUS_COLORS[b.active_version.status]}`}
                        >
                          v{b.active_version.version_number} ·{" "}
                          {STATUS_LABELS[b.active_version.status]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground/80 font-medium">
                      {b.active_version
                        ? formatBRL(b.active_version.net_total)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(b.created_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
