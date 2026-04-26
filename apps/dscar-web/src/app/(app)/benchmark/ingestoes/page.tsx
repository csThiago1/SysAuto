"use client"

import { useState } from "react"
import { Upload, RefreshCw, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { Input } from "@/components/ui/input"
import {
  useBenchmarkIngestoes,
  useBenchmarkFontes,
  useCreateBenchmarkIngestao,
  useAmostrasPorIngestao,
} from "@/hooks/useBenchmark"
import type { BenchmarkIngestaoStatus } from "@paddock/types"

const STATUS_LABELS: Record<BenchmarkIngestaoStatus, string> = {
  recebido: "Recebido",
  processando: "Processando...",
  concluido: "Concluído",
  erro: "Erro",
}

const STATUS_BADGE_CLS: Record<BenchmarkIngestaoStatus, string> = {
  recebido: "border-white/20 text-white/50 bg-white/5",
  processando: "border-blue-500/30 text-blue-400 bg-blue-400/10",
  concluido: "border-success-500/30 text-success-400 bg-success-400/10",
  erro: "border-red-500/30 text-red-400 bg-red-400/10",
}

export default function BenchmarkIngestoesPage() {
  const { data: ingestoes = [], isLoading, refetch } = useBenchmarkIngestoes()
  const { data: fontes = [] } = useBenchmarkFontes()
  const { mutateAsync: criar, isPending } = useCreateBenchmarkIngestao()

  const [showForm, setShowForm] = useState(false)
  const [fonteId, setFonteId] = useState("")
  const [periodoRef, setPeriodoRef] = useState("")
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fonteId) {
      toast.error("Selecione uma fonte.")
      return
    }
    const fd = new FormData()
    fd.append("fonte", fonteId)
    fd.append("metadados", JSON.stringify({ periodo_ref: periodoRef }))
    if (arquivo) fd.append("arquivo", arquivo)
    try {
      await criar(fd)
      toast.success("Ingestão iniciada. O processamento ocorre em background.")
      setShowForm(false)
      setFonteId("")
      setArquivo(null)
      setPeriodoRef("")
    } catch {
      toast.error("Erro ao iniciar ingestão.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Ingestões de Benchmark</h1>
            <p className="text-xs text-white/40 mt-0.5">PDFs e arquivos de seguradora processados pelo motor.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/40 hover:text-white"
            onClick={() => refetch()}
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Upload className="h-4 w-4 mr-1" />
            Nova Ingestão
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Nova Ingestão</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Fonte *</Label>
              <Select value={fonteId} onValueChange={setFonteId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Selecionar fonte..." />
                </SelectTrigger>
                <SelectContent>
                  {fontes.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Período de referência</Label>
              <Input
                type="date"
                className="bg-white/5 border-white/10 text-white"
                value={periodoRef}
                onChange={(e) => setPeriodoRef(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Arquivo PDF / CSV</Label>
            <input
              type="file"
              accept=".pdf,.csv"
              className="block text-sm text-white/60 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-white/10 file:text-white"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Enviando..." : "Iniciar"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-white/40 py-8 text-center">Carregando...</p>
      ) : ingestoes.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma ingestão registrada.
        </div>
      ) : (
        <div className="space-y-2">
          {ingestoes.map((ing) => (
            <div key={ing.id} className="rounded-lg border border-white/10 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
                onClick={() => setExpandedId(expandedId === ing.id ? null : ing.id)}
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={STATUS_BADGE_CLS[ing.status]}
                  >
                    {STATUS_LABELS[ing.status]}
                  </Badge>
                  <span className="text-sm text-white">{ing.fonte_nome}</span>
                  <span className="text-xs text-white/40">
                    {new Date(ing.criado_em).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/40">
                  <span>{ing.amostras_importadas} amostras</span>
                  <span>{ing.amostras_descartadas} descartadas</span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${expandedId === ing.id ? "rotate-90" : ""}`} />
                </div>
              </button>
              {expandedId === ing.id && (
                <IngestaoDetail ingestaoId={ing.id} logErro={ing.log_erro} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IngestaoDetail({ ingestaoId, logErro }: { ingestaoId: string; logErro: string }) {
  const { data: amostras = [], isLoading } = useAmostrasPorIngestao(ingestaoId)

  if (isLoading) {
    return <div className="px-4 py-3 text-white/40 text-xs">Carregando amostras...</div>
  }

  return (
    <div className="border-t border-white/10 px-4 py-3 space-y-3">
      {logErro && (
        <div className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2 font-mono">
          {logErro.slice(0, 500)}
        </div>
      )}
      {amostras.length === 0 ? (
        <p className="text-xs text-white/40">Sem amostras ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/40 text-xs py-1.5">Descrição</TableHead>
                <TableHead className="text-white/40 text-xs py-1.5 text-right">Valor</TableHead>
                <TableHead className="text-white/40 text-xs py-1.5 text-right">Confiança</TableHead>
                <TableHead className="text-white/40 text-xs py-1.5">Canônico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {amostras.slice(0, 20).map((a) => (
                <TableRow key={a.id} className="border-white/5">
                  <TableCell className="py-1.5 text-xs text-white/70 max-w-xs truncate">
                    {a.descricao_bruta}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs text-right text-white/70">
                    R$ {parseFloat(a.valor_praticado).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs text-right">
                    {a.alias_match_confianca ? (
                      <span className={parseFloat(a.alias_match_confianca) >= 0.85 ? "text-success-400" : "text-yellow-400"}>
                        {(parseFloat(a.alias_match_confianca) * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5 text-xs text-white/50">
                    {a.servico_nome || a.peca_nome || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {amostras.length > 20 && (
            <p className="text-xs text-white/30 mt-2">Mostrando 20 de {amostras.length} amostras.</p>
          )}
        </div>
      )}
    </div>
  )
}
