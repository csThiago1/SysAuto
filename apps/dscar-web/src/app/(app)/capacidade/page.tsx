"use client"

import { useState } from "react"
import { Users, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useCapacidades,
  useBloqueios,
  useHeatmapSemana,
  useCreateCapacidade,
  useDeleteCapacidade,
  useCreateBloqueio,
  useDeleteBloqueio,
} from "@/hooks/useCapacidade"
import type { HeatmapDia } from "@paddock/types"

function startOfWeek(d: Date): string {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const seg = new Date(d)
  seg.setDate(diff)
  return seg.toISOString().slice(0, 10)
}

function utilizacaoColor(u: number): string {
  if (u < 0.5) return "bg-emerald-500"
  if (u < 0.8) return "bg-yellow-500"
  return "bg-red-500"
}

function HeatmapWidget({ dias }: { dias: HeatmapDia[] }) {
  const diasSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
        Utilização da Semana
      </h3>
      <div className="grid grid-cols-7 gap-1">
        {diasSemana.map((d, i) => (
          <div key={d} className="text-center">
            <p className="text-xs text-white/40 mb-1">{d}</p>
            {dias[i] ? (
              <div
                className={`h-8 rounded ${utilizacaoColor(dias[i].utilizacao_geral)} opacity-80`}
                title={`${(dias[i].utilizacao_geral * 100).toFixed(0)}%`}
              />
            ) : (
              <div className="h-8 rounded bg-white/10" />
            )}
            {dias[i] && (
              <p className="text-xs text-white/40 mt-1">
                {(dias[i].utilizacao_geral * 100).toFixed(0)}%
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-white/40">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          Livre
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />
          Médio
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
          Crítico
        </span>
      </div>
    </div>
  )
}

export default function CapacidadePage() {
  const semanaInicio = startOfWeek(new Date())
  const { data: capacidades = [], isLoading: loadingCap } = useCapacidades()
  const { data: bloqueios = [], isLoading: loadingBlq } = useBloqueios()
  const { data: heatmap = [] } = useHeatmapSemana(semanaInicio)
  const { mutateAsync: criarCap, isPending: criandoCap } = useCreateCapacidade()
  const { mutateAsync: deleteCap } = useDeleteCapacidade()
  const { mutateAsync: criarBlq, isPending: criandoBlq } = useCreateBloqueio()
  const { mutateAsync: deleteBlq } = useDeleteBloqueio()

  const [showCapForm, setShowCapForm] = useState(false)
  const [showBlqForm, setShowBlqForm] = useState(false)
  const [capForm, setCapForm] = useState({
    tecnico: "",
    categoria_mao_obra: "",
    horas_dia_util: "8",
    vigente_desde: "",
  })
  const [blqForm, setBlqForm] = useState({
    tecnico: "",
    data_inicio: "",
    data_fim: "",
    motivo: "",
  })

  async function handleCriarCap() {
    try {
      await criarCap({ ...capForm, dias_semana: [1, 2, 3, 4, 5] })
      toast.success("Capacidade criada!")
      setShowCapForm(false)
      setCapForm({ tecnico: "", categoria_mao_obra: "", horas_dia_util: "8", vigente_desde: "" })
    } catch {
      toast.error("Erro ao criar capacidade.")
    }
  }

  async function handleCriarBlq() {
    try {
      await criarBlq(blqForm)
      toast.success("Bloqueio criado!")
      setShowBlqForm(false)
      setBlqForm({ tecnico: "", data_inicio: "", data_fim: "", motivo: "" })
    } catch {
      toast.error("Erro ao criar bloqueio.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Capacidade Técnica</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Disponibilidade e utilização da equipe técnica por categoria.
          </p>
        </div>
      </div>

      {/* Heatmap semanal */}
      {heatmap.length > 0 && <HeatmapWidget dias={heatmap} />}

      {/* Capacidades */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Capacidades por Técnico</h2>
          <Button size="sm" onClick={() => setShowCapForm(!showCapForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Capacidade
          </Button>
        </div>

        {showCapForm && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">UUID do Técnico *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-xs"
                  placeholder="UUID do Employee"
                  value={capForm.tecnico}
                  onChange={(e) => setCapForm(p => ({ ...p, tecnico: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">UUID da Categoria *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-xs"
                  placeholder="UUID de CategoriaMaoObra"
                  value={capForm.categoria_mao_obra}
                  onChange={(e) => setCapForm(p => ({ ...p, categoria_mao_obra: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Horas/dia útil</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white"
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={capForm.horas_dia_util}
                  onChange={(e) => setCapForm(p => ({ ...p, horas_dia_util: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Vigente desde *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white"
                  type="date"
                  value={capForm.vigente_desde}
                  onChange={(e) => setCapForm(p => ({ ...p, vigente_desde: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowCapForm(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCriarCap} disabled={criandoCap}>
                {criandoCap ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        )}

        {loadingCap ? (
          <p className="text-xs text-white/40 py-8 text-center">Carregando...</p>
        ) : capacidades.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-white/40 text-sm">
            Nenhuma capacidade cadastrada.
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/60 text-xs">Técnico</TableHead>
                  <TableHead className="text-white/60 text-xs">Categoria</TableHead>
                  <TableHead className="text-white/60 text-xs text-right">Horas/dia</TableHead>
                  <TableHead className="text-white/60 text-xs">Vigente desde</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {capacidades.map((c) => (
                  <TableRow key={c.id} className="border-white/10">
                    <TableCell className="text-white/70 font-mono text-xs">{c.tecnico}</TableCell>
                    <TableCell className="text-white/70 font-mono text-xs">{c.categoria_mao_obra}</TableCell>
                    <TableCell className="text-right text-white text-sm">{c.horas_dia_util}h</TableCell>
                    <TableCell className="text-white/60 text-xs">{c.vigente_desde}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white/30 hover:text-red-400"
                        onClick={() => deleteCap(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Bloqueios */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Bloqueios de Capacidade</h2>
          <Button variant="outline" size="sm" onClick={() => setShowBlqForm(!showBlqForm)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Bloqueio
          </Button>
        </div>

        {showBlqForm && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">UUID do Técnico *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono text-xs"
                  placeholder="UUID do Employee"
                  value={blqForm.tecnico}
                  onChange={(e) => setBlqForm(p => ({ ...p, tecnico: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Motivo *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                  placeholder="Ex: Férias, Licença médica"
                  value={blqForm.motivo}
                  onChange={(e) => setBlqForm(p => ({ ...p, motivo: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Data início *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white"
                  type="date"
                  value={blqForm.data_inicio}
                  onChange={(e) => setBlqForm(p => ({ ...p, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Data fim *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white"
                  type="date"
                  value={blqForm.data_fim}
                  onChange={(e) => setBlqForm(p => ({ ...p, data_fim: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowBlqForm(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCriarBlq} disabled={criandoBlq}>
                {criandoBlq ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        )}

        {loadingBlq ? (
          <p className="text-xs text-white/40 py-8 text-center">Carregando...</p>
        ) : bloqueios.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-white/40 text-sm">
            Nenhum bloqueio cadastrado.
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/60 text-xs">Técnico</TableHead>
                  <TableHead className="text-white/60 text-xs">Período</TableHead>
                  <TableHead className="text-white/60 text-xs">Motivo</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bloqueios.map((b) => (
                  <TableRow key={b.id} className="border-white/10">
                    <TableCell className="text-white/70 font-mono text-xs">{b.tecnico}</TableCell>
                    <TableCell className="text-white/60 text-xs">{b.data_inicio} → {b.data_fim}</TableCell>
                    <TableCell className="text-white/80 text-sm">{b.motivo}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white/30 hover:text-red-400"
                        onClick={() => deleteBlq(b.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
