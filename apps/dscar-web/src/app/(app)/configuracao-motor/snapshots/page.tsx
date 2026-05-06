"use client"

import { useState } from "react"
import { Layers, Search, ChevronRight } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSnapshots } from "@/hooks/usePricingEngine"
import { useSession } from "next-auth/react"
import type { Snapshot } from "@paddock/types"

const ORIGEM_LABELS: Record<string, string> = {
  orcamento_linha: "Orçamento",
  os_linha: "OS",
  simulacao: "Simulação",
}

function formatCurrency(val: string) {
  const n = parseFloat(val)
  return isNaN(n)
    ? val
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function SnapshotRow({ snap }: { snap: Snapshot }) {
  const ctx = snap.contexto as {
    veiculo?: { marca?: string; modelo?: string; ano?: number }
    segmento_codigo?: string
  }

  return (
    <TableRow className="border-border hover:bg-muted/50 cursor-pointer">
      <TableCell className="text-xs font-mono text-muted-foreground">
        {snap.id.slice(0, 8)}…
      </TableCell>
      <TableCell className="text-sm text-foreground/80">
        {ctx.veiculo
          ? `${ctx.veiculo.marca} ${ctx.veiculo.modelo} ${ctx.veiculo.ano}`
          : "—"}
      </TableCell>
      <TableCell className="text-xs text-foreground/60">
        {ctx.segmento_codigo ?? "—"}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs border-border text-foreground/60">
          {ORIGEM_LABELS[snap.origem] ?? snap.origem}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-right font-mono text-success-400">
        {formatCurrency(snap.preco_final)}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(snap.calculado_em).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </TableCell>
      <TableCell>
        <Link href={`/configuracao-motor/snapshots/${snap.id}` as Route}>
          <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground/70 transition-colors" />
        </Link>
      </TableCell>
    </TableRow>
  )
}

export default function SnapshotsPage() {
  const { data: session } = useSession()
  const empresaId = (session as { empresaId?: string } | null)?.empresaId ?? ""

  const [origem, setOrigem] = useState<string>("all")
  const [search, setSearch] = useState("")

  const filters: Record<string, string> = { empresa: empresaId }
  if (origem !== "all") filters.origem = origem

  const { data: snapshots = [], isLoading } = useSnapshots(
    empresaId ? filters : undefined
  )

  const filtered = search
    ? snapshots.filter((s) => {
        const ctx = s.contexto as { veiculo?: { marca?: string; modelo?: string } }
        const veiculo = `${ctx.veiculo?.marca ?? ""} ${ctx.veiculo?.modelo ?? ""}`.toLowerCase()
        return veiculo.includes(search.toLowerCase()) || s.id.includes(search)
      })
    : snapshots

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Snapshots de Custo</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Histórico imutável de cálculos de preço para auditoria.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground text-sm"
            placeholder="Buscar por veículo ou ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={origem} onValueChange={setOrigem}>
          <SelectTrigger className="w-44 bg-muted/50 border-border text-foreground text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            <SelectItem value="orcamento_linha">Orçamento</SelectItem>
            <SelectItem value="os_linha">OS</SelectItem>
            <SelectItem value="simulacao">Simulação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-12 text-center">Carregando snapshots…</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-foreground/60 text-xs">ID</TableHead>
                <TableHead className="text-foreground/60 text-xs">Veículo</TableHead>
                <TableHead className="text-foreground/60 text-xs">Segmento</TableHead>
                <TableHead className="text-foreground/60 text-xs">Origem</TableHead>
                <TableHead className="text-foreground/60 text-xs text-right">Preço Final</TableHead>
                <TableHead className="text-foreground/60 text-xs">Calculado em</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-12">
                    Nenhum snapshot encontrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((snap) => (
                <SnapshotRow key={snap.id} snap={snap} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
