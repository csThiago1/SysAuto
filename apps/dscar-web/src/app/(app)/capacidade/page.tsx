"use client"

import { useState } from "react"
import { Users, Plus, Trash2, Search, X } from "lucide-react"
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
import { useEmployees } from "@/hooks/useHR"
import { useCategoriasMaoObra } from "@/hooks/usePricingCatalog"
import type { HeatmapDia, EmployeeListItem } from "@paddock/types"

function startOfWeek(d: Date): string {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const seg = new Date(d)
  seg.setDate(diff)
  return seg.toISOString().slice(0, 10)
}

function utilizacaoColor(u: number): string {
  if (u < 0.5) return "bg-success-500"
  if (u < 0.8) return "bg-warning-500"
  return "bg-error-500"
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
          <span className="h-2 w-2 rounded-full bg-success-500 inline-block" />
          Livre
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-warning-500 inline-block" />
          Médio
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-error-500 inline-block" />
          Crítico
        </span>
      </div>
    </div>
  )
}

// ── Busca de técnico ───────────────────────────────────────────────────────────

function TecnicoSearch({
  value,
  onChange,
}: {
  value: { id: string; nome: string } | null
  onChange: (v: { id: string; nome: string } | null) => void
}) {
  const [search, setSearch] = useState("")
  const { data } = useEmployees(search.length >= 2 ? { search } : {})
  const funcionarios = data?.results ?? []

  if (value) {
    return (
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
        <span className="text-sm text-white">{value.nome}</span>
        <button type="button" onClick={() => onChange(null)} className="text-white/30 hover:text-white/70">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        <Input
          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-8"
          placeholder="Buscar colaborador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {funcionarios.length > 0 && (
        <div className="rounded-md border border-white/10 overflow-hidden max-h-40 overflow-y-auto">
          {funcionarios.slice(0, 6).map((emp: EmployeeListItem) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => { onChange({ id: emp.id, nome: emp.user.name }); setSearch("") }}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
            >
              <span className="text-sm text-white">{emp.user.name}</span>
              <span className="text-xs text-white/40">{emp.position_display}</span>
            </button>
          ))}
        </div>
      )}
      {search.length >= 2 && funcionarios.length === 0 && (
        <p className="text-xs text-white/30 px-1">Nenhum colaborador encontrado.</p>
      )}
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default function CapacidadePage() {
  const semanaInicio = startOfWeek(new Date())
  const { data: capacidades = [], isLoading: loadingCap } = useCapacidades()
  const { data: bloqueios = [], isLoading: loadingBlq } = useBloqueios()
  const { data: heatmap = [] } = useHeatmapSemana(semanaInicio)
  const { data: categorias = [] } = useCategoriasMaoObra()
  const { mutateAsync: criarCap, isPending: criandoCap } = useCreateCapacidade()
  const { mutateAsync: deleteCap } = useDeleteCapacidade()
  const { mutateAsync: criarBlq, isPending: criandoBlq } = useCreateBloqueio()
  const { mutateAsync: deleteBlq } = useDeleteBloqueio()

  const [showCapForm, setShowCapForm] = useState(false)
  const [showBlqForm, setShowBlqForm] = useState(false)

  // Capacidade form
  const [capTecnico, setCapTecnico] = useState<{ id: string; nome: string } | null>(null)
  const [capCategoria, setCapCategoria] = useState("")
  const [capHoras, setCapHoras] = useState("8")
  const [capVigente, setCapVigente] = useState("")

  // Bloqueio form
  const [blqTecnico, setBlqTecnico] = useState<{ id: string; nome: string } | null>(null)
  const [blqMotivo, setBlqMotivo] = useState("")
  const [blqInicio, setBlqInicio] = useState("")
  const [blqFim, setBlqFim] = useState("")

  async function handleCriarCap() {
    if (!capTecnico || !capCategoria || !capVigente) {
      toast.error("Preencha técnico, categoria e data de vigência.")
      return
    }
    try {
      await criarCap({
        tecnico: capTecnico.id,
        categoria_mao_obra: capCategoria,
        horas_dia_util: capHoras,
        vigente_desde: capVigente,
        dias_semana: [1, 2, 3, 4, 5],
      })
      toast.success("Capacidade criada!")
      setShowCapForm(false)
      setCapTecnico(null); setCapCategoria(""); setCapHoras("8"); setCapVigente("")
    } catch {
      toast.error("Erro ao criar capacidade.")
    }
  }

  async function handleCriarBlq() {
    if (!blqTecnico || !blqInicio || !blqFim || !blqMotivo) {
      toast.error("Preencha todos os campos do bloqueio.")
      return
    }
    try {
      await criarBlq({ tecnico: blqTecnico.id, data_inicio: blqInicio, data_fim: blqFim, motivo: blqMotivo })
      toast.success("Bloqueio criado!")
      setShowBlqForm(false)
      setBlqTecnico(null); setBlqMotivo(""); setBlqInicio(""); setBlqFim("")
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
                <Label className="text-white/70 text-xs">Técnico *</Label>
                <TecnicoSearch value={capTecnico} onChange={setCapTecnico} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Categoria de mão de obra *</Label>
                <select
                  className="w-full text-sm bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={capCategoria}
                  onChange={(e) => setCapCategoria(e.target.value)}
                >
                  <option value="">Selecione a categoria</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Horas/dia útil</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white"
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={capHoras}
                  onChange={(e) => setCapHoras(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Vigente desde *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white"
                  type="date"
                  value={capVigente}
                  onChange={(e) => setCapVigente(e.target.value)}
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
                    <TableCell className="text-white/70 text-sm">{c.tecnico}</TableCell>
                    <TableCell className="text-white/70 text-sm">{c.categoria_mao_obra}</TableCell>
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
                <Label className="text-white/70 text-xs">Técnico *</Label>
                <TecnicoSearch value={blqTecnico} onChange={setBlqTecnico} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Motivo *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                  placeholder="Ex: Férias, Licença médica"
                  value={blqMotivo}
                  onChange={(e) => setBlqMotivo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Data início *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white"
                  type="date"
                  value={blqInicio}
                  onChange={(e) => setBlqInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Data fim *</Label>
                <Input
                  className="bg-white/5 border-white/10 text-white"
                  type="date"
                  value={blqFim}
                  onChange={(e) => setBlqFim(e.target.value)}
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
                    <TableCell className="text-white/70 text-sm">{b.tecnico}</TableCell>
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
