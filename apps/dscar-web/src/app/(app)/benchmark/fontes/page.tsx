"use client"

import { useState } from "react"
import { Database, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useBenchmarkFontes, useCreateBenchmarkFonte } from "@/hooks/useBenchmark"
import { useEmpresas } from "@/hooks/usePricingProfile"
import type { BenchmarkFonteTipo } from "@paddock/types"

const TIPO_LABELS: Record<BenchmarkFonteTipo, string> = {
  seguradora_pdf: "PDF Seguradora",
  seguradora_json: "API JSON",
  cotacao_externa: "Cotação Externa",
  concorrente: "Auditoria Concorrente",
}

export default function BenchmarkFontesPage() {
  const { data: fontes = [], isLoading } = useBenchmarkFontes()
  const { mutateAsync: criar, isPending } = useCreateBenchmarkFonte()
  const { data: empresasData } = useEmpresas()
  const empresas = empresasData ?? []

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    nome: "",
    tipo: "seguradora_pdf" as BenchmarkFonteTipo,
    confiabilidade: "0.80",
    empresa_id: "",
  })

  const set = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.empresa_id) {
      toast.error("Preencha nome e selecione a empresa.")
      return
    }
    try {
      await criar({
        nome: form.nome,
        tipo: form.tipo,
        confiabilidade: form.confiabilidade,
        empresa: form.empresa_id,
      })
      toast.success("Fonte criada!")
      setShowForm(false)
      setForm({ nome: "", tipo: "seguradora_pdf", confiabilidade: "0.80", empresa_id: "" })
    } catch {
      toast.error("Erro ao criar fonte.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">Fontes de Benchmark</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Seguradoras, marketplaces e concorrentes como fonte de preços de mercado.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Fonte
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Nova Fonte</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Nome *</Label>
              <Input
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex: Porto Seguro Q1 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Empresa *</Label>
              <select
                className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={form.empresa_id}
                onChange={(e) => set("empresa_id", e.target.value)}
              >
                <option value="">Selecione a empresa</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Confiabilidade (0–1)</Label>
              <Input
                className="bg-white/5 border-white/10 text-white"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={form.confiabilidade}
                onChange={(e) => set("confiabilidade", e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Criando..." : "Criar"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-white/40 py-8 text-center">Carregando...</p>
      ) : fontes.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-white/40 text-sm">
          Nenhuma fonte cadastrada.
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/60 text-xs">Nome</TableHead>
                <TableHead className="text-white/60 text-xs">Tipo</TableHead>
                <TableHead className="text-white/60 text-xs text-right">Confiabilidade</TableHead>
                <TableHead className="text-white/60 text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fontes.map((f) => (
                <TableRow key={f.id} className="border-white/10">
                  <TableCell className="text-sm text-white">{f.nome}</TableCell>
                  <TableCell className="text-sm text-white/60">{TIPO_LABELS[f.tipo]}</TableCell>
                  <TableCell className="text-sm text-right font-mono text-white/60">
                    {(parseFloat(f.confiabilidade) * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        f.is_active
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-400/10"
                          : "border-red-500/30 text-red-400 bg-red-400/10"
                      }
                    >
                      {f.is_active ? "Ativa" : "Inativa"}
                    </Badge>
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
