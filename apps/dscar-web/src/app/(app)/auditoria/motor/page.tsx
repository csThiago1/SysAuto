"use client"

import { useState } from "react"
import { Shield, CheckCircle2, XCircle } from "lucide-react"
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
import { useAuditoriaMotor, useMotorHealthcheck } from "@/hooks/useCapacidade"
import type { AuditoriaOperacao } from "@paddock/types"

const OPERACOES: { value: AuditoriaOperacao | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "calcular_servico", label: "Calcular Serviço" },
  { value: "calcular_peca", label: "Calcular Peça" },
  { value: "simular", label: "Simular" },
  { value: "benchmark_check", label: "Benchmark Check" },
]

export default function AuditoriaMotorPage() {
  const [operacao, setOperacao] = useState<AuditoriaOperacao | "all">("all")
  const [somenteErros, setSomenteErros] = useState(false)

  const { data: health } = useMotorHealthcheck()
  const { data: auditorias = [], isLoading } = useAuditoriaMotor(
    operacao !== "all" ? operacao : undefined,
    somenteErros ? false : undefined
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Auditoria do Motor</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Log imutável de todas as chamadas ao motor de precificação.
          </p>
        </div>
      </div>

      {/* Healthcheck KPIs */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Status",
              value: health.status === "ok" ? "Operacional" : "Degradado",
              icon: health.status === "ok" ? (
                <CheckCircle2 className="h-4 w-4 text-success-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              ),
              color: health.status === "ok" ? "text-success-400" : "text-error-400",
            },
            {
              label: "Total de chamadas",
              value: health.total_chamadas?.toLocaleString("pt-BR") ?? "—",
              color: "text-foreground",
            },
            {
              label: "Taxa de erro",
              value: health.taxa_erro_pct != null ? `${health.taxa_erro_pct.toFixed(1)}%` : "—",
              color: (health.taxa_erro_pct ?? 0) > 5 ? "text-error-400" : "text-success-400",
            },
            {
              label: "Tempo médio",
              value: health.tempo_medio_ms != null ? `${health.tempo_medio_ms}ms` : "—",
              color: "text-foreground",
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                {"icon" in kpi && kpi.icon}
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
              <p className={`text-lg font-semibold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={operacao}
          onValueChange={(v) => setOperacao(v as AuditoriaOperacao | "all")}
        >
          <SelectTrigger className="w-48 bg-muted/50 border-border text-foreground text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERACOES.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm text-foreground/60 cursor-pointer">
          <input
            type="checkbox"
            checked={somenteErros}
            onChange={(e) => setSomenteErros(e.target.checked)}
            className="rounded"
          />
          Somente erros
        </label>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Carregando...</p>
      ) : auditorias.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-muted-foreground text-sm">
          Nenhuma auditoria encontrada.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground/60 text-xs">Status</TableHead>
                  <TableHead className="text-foreground/60 text-xs">Operação</TableHead>
                  <TableHead className="text-foreground/60 text-xs text-right">Tempo</TableHead>
                  <TableHead className="text-foreground/60 text-xs">Data</TableHead>
                  <TableHead className="text-foreground/60 text-xs">Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditorias.map((a) => (
                  <TableRow key={a.id} className="border-border">
                    <TableCell>
                      {a.sucesso ? (
                        <Badge
                          variant="outline"
                          className="border-success-500/30 text-success-400 bg-success-400/10 gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          OK
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-red-500/30 text-red-400 bg-red-400/10 gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          Erro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground/80 text-xs font-mono">{a.operacao}</TableCell>
                    <TableCell className="text-right text-foreground/60 text-xs">
                      {a.tempo_ms}ms
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-red-400 text-xs max-w-xs truncate">
                      {a.erro_msg || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-2 border-t border-white/5 text-xs text-muted-foreground">
            Mostrando até 500 registros mais recentes.
          </div>
        </div>
      )}
    </div>
  )
}
