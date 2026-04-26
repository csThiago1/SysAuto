"use client"

import { useState } from "react"
import { TrendingUp, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useVarianciasFicha, useVarianciasPeca, useGerarVariancias } from "@/hooks/useCapacidade"

const formatPct = (v: string) => {
  const n = parseFloat(v)
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`
}

const pctColor = (v: string) => {
  const n = Math.abs(parseFloat(v))
  if (n < 0.1) return "text-success-400"
  if (n < 0.2) return "text-yellow-400"
  return "text-red-400"
}

export default function VarianciasPage() {
  const [mes, setMes] = useState("")
  const [apenasAlertas, setApenasAlertas] = useState(false)

  const { data: fichas = [], isLoading: loadingFichas } = useVarianciasFicha(mes || undefined)
  const { data: pecas = [], isLoading: loadingPecas } = useVarianciasPeca(mes || undefined, apenasAlertas)
  const { mutateAsync: gerar, isPending: gerando } = useGerarVariancias()

  async function handleGerar() {
    try {
      const resultado = await gerar(undefined)
      toast.success(`Enfileirado para ${resultado.mes_referencia}`)
    } catch {
      toast.error("Erro ao gerar variâncias.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Variâncias do Motor</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Desvios entre estimado (ficha técnica) e realizado (apontamento/NF-e).
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGerar}
          disabled={gerando}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${gerando ? "animate-spin" : ""}`} />
          {gerando ? "Gerando..." : "Gerar variâncias"}
        </Button>
      </div>

      <Tabs defaultValue="fichas">
        <div className="flex items-center gap-4 flex-wrap">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="fichas" className="text-xs">
              Fichas Técnicas
            </TabsTrigger>
            <TabsTrigger value="pecas" className="text-xs">
              Custo de Peças
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="space-y-0">
              <Label className="text-white/50 text-xs block mb-1">Mês de referência</Label>
              <Input
                type="month"
                className="bg-white/5 border-white/10 text-white h-9 text-sm"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Fichas */}
        <TabsContent value="fichas" className="mt-4">
          {loadingFichas ? (
            <p className="text-xs text-white/40 py-8 text-center">Carregando...</p>
          ) : fichas.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
              Sem variâncias de ficha para o período selecionado.
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/60 text-xs">Serviço Canônico</TableHead>
                    <TableHead className="text-white/60 text-xs">Mês</TableHead>
                    <TableHead className="text-white/60 text-xs text-right">OS</TableHead>
                    <TableHead className="text-white/60 text-xs text-right">Δ Horas</TableHead>
                    <TableHead className="text-white/60 text-xs text-right">Δ Insumo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fichas.map((f) => (
                    <TableRow key={f.id} className="border-white/10">
                      <TableCell className="text-white/70 font-mono text-xs max-w-[200px] truncate">
                        {f.servico_canonico_id}
                      </TableCell>
                      <TableCell className="text-white/60 text-xs">{f.mes_referencia.slice(0, 7)}</TableCell>
                      <TableCell className="text-right text-white/60 text-sm">{f.qtd_os}</TableCell>
                      <TableCell className={`text-right font-semibold text-sm ${pctColor(f.variancia_horas_pct)}`}>
                        {formatPct(f.variancia_horas_pct)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold text-sm ${pctColor(f.variancia_insumo_pct)}`}>
                        {formatPct(f.variancia_insumo_pct)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Peças */}
        <TabsContent value="pecas" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={apenasAlertas}
                onChange={(e) => setApenasAlertas(e.target.checked)}
                className="rounded"
              />
              Somente alertas (&gt;15%)
            </label>
            {apenasAlertas && (
              <Badge
                variant="outline"
                className="border-yellow-500/30 text-yellow-400 bg-yellow-400/10"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Filtro ativo
              </Badge>
            )}
          </div>

          {loadingPecas ? (
            <p className="text-xs text-white/40 py-8 text-center">Carregando...</p>
          ) : pecas.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
              Sem variâncias de peça para o período selecionado.
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/60 text-xs">Peça Canônica</TableHead>
                    <TableHead className="text-white/60 text-xs">Mês</TableHead>
                    <TableHead className="text-white/60 text-xs text-right">Amostras</TableHead>
                    <TableHead className="text-white/60 text-xs text-right">Custo Snapshot</TableHead>
                    <TableHead className="text-white/60 text-xs text-right">Custo NF-e</TableHead>
                    <TableHead className="text-white/60 text-xs text-right">Δ</TableHead>
                    <TableHead className="text-white/60 text-xs text-center">Alerta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pecas.map((p) => (
                    <TableRow key={p.id} className="border-white/10">
                      <TableCell className="text-white/70 font-mono text-xs max-w-[180px] truncate">
                        {p.peca_canonica_id}
                      </TableCell>
                      <TableCell className="text-white/60 text-xs">{p.mes_referencia.slice(0, 7)}</TableCell>
                      <TableCell className="text-right text-white/60 text-sm">{p.qtd_amostras}</TableCell>
                      <TableCell className="text-right text-white/70 text-sm">
                        R$ {parseFloat(p.custo_snapshot_medio).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-white/70 text-sm">
                        R$ {parseFloat(p.custo_nfe_medio).toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold text-sm ${pctColor(p.variancia_pct)}`}>
                        {formatPct(p.variancia_pct)}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.alerta && (
                          <AlertTriangle className="h-4 w-4 text-yellow-400 inline-block" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
