"use client"

import { useState } from "react"
import { toast } from "sonner"
import { FlaskConical, Plus, Trash2, PlayCircle, CheckCircle, XCircle, Search, X } from "lucide-react"
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
import { useSession } from "next-auth/react"
import { useCalcularServico } from "@/hooks/usePricingEngine"
import { useServicosCanonico } from "@/hooks/usePricingCatalog"
import { useTiposPintura } from "@/hooks/usePricingProfile"
import type { CalcularServicoInput, ResultadoServicoDTO } from "@paddock/types"

function formatCurrency(val: string) {
  const n = parseFloat(val)
  return isNaN(n) ? val : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatMargem(val: string) {
  const n = parseFloat(val)
  return isNaN(n) ? val : `${(n * 100).toFixed(2)}%`
}

// ── Linha de busca de serviço ──────────────────────────────────────────────────

interface ServicoSelecionado {
  id: string
  nome: string
}

function ServicoSearchRow({
  value,
  onChange,
  onRemove,
  showRemove,
}: {
  value: ServicoSelecionado | null
  onChange: (s: ServicoSelecionado | null) => void
  onRemove: () => void
  showRemove: boolean
}) {
  const [search, setSearch] = useState("")
  const { data: servicos = [] } = useServicosCanonico(search.length >= 2 ? search : undefined)

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
          <span className="text-sm text-white">{value.nome}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-white/30 hover:text-white/60 ml-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {showRemove && (
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white/30 hover:text-red-400" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <Input
            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-8"
            placeholder="Buscar serviço (ex: funilaria, pintura, alinhamento…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {showRemove && (
          <Button variant="ghost" size="icon" className="h-9 w-9 text-white/30 hover:text-red-400" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {servicos.length > 0 && (
        <div className="rounded-md border border-white/10 overflow-hidden max-h-44 overflow-y-auto ml-0">
          {servicos.slice(0, 8).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onChange({ id: s.id, nome: s.nome }); setSearch("") }}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
            >
              <span className="text-sm text-white">{s.nome}</span>
              {s.categoria_nome && (
                <span className="text-xs text-white/30 ml-2 shrink-0">{s.categoria_nome}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {search.length >= 2 && servicos.length === 0 && (
        <p className="text-xs text-white/30 px-1">Nenhum serviço encontrado.</p>
      )}
    </div>
  )
}

// ── Resultado de um serviço ────────────────────────────────────────────────────

interface Resultado {
  servico_nome: string
  status: "ok" | "erro"
  data?: ResultadoServicoDTO
  erro?: string
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function SimuladorPage() {
  const { data: session } = useSession()
  const empresaId = (session as { empresaId?: string } | null)?.empresaId ?? ""

  const { data: tiposPintura = [] } = useTiposPintura()

  const [marca, setMarca] = useState("")
  const [modelo, setModelo] = useState("")
  const [ano, setAno] = useState("")
  const [tipoPinturaCodigo, setTipoPinturaCodigo] = useState("_none")

  const [servicos, setServicos] = useState<(ServicoSelecionado | null)[]>([null])

  const calcularServico = useCalcularServico()
  const [resultados, setResultados] = useState<Resultado[]>([])

  function addServico() {
    setServicos((prev) => [...prev, null])
  }

  function removeServico(idx: number) {
    setServicos((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateServico(idx: number, val: ServicoSelecionado | null) {
    setServicos((prev) => prev.map((s, i) => (i === idx ? val : s)))
  }

  async function handleSimular() {
    if (!marca || !modelo || !ano) {
      toast.error("Informe marca, modelo e ano do veículo.")
      return
    }
    const selecionados = servicos.filter(Boolean) as ServicoSelecionado[]
    if (selecionados.length === 0) {
      toast.error("Selecione pelo menos um serviço.")
      return
    }

    const contexto: CalcularServicoInput["contexto"] = {
      empresa_id: empresaId,
      veiculo_marca: marca,
      veiculo_modelo: modelo,
      veiculo_ano: parseInt(ano, 10),
      tipo_pintura_codigo: tipoPinturaCodigo === "_none" ? null : tipoPinturaCodigo,
    }

    const novosResultados: Resultado[] = []
    for (const svc of selecionados) {
      try {
        const data = await calcularServico.mutateAsync({
          contexto,
          servico_canonico_id: svc.id,
          origem: "simulacao",
        })
        novosResultados.push({ servico_nome: svc.nome, status: "ok", data })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido"
        novosResultados.push({ servico_nome: svc.nome, status: "erro", erro: msg })
      }
    }

    setResultados(novosResultados)
    const erros = novosResultados.filter((r) => r.status === "erro").length
    if (erros === 0) {
      toast.success(`${novosResultados.length} cálculo(s) concluído(s).`)
    } else {
      toast.warning(`${novosResultados.length - erros} OK · ${erros} com erro.`)
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <FlaskConical className="h-5 w-5 text-primary-500" />
        <div>
          <h1 className="text-lg font-semibold text-white">Simulador</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Calcule o preço de serviços com base no veículo do cliente.
          </p>
        </div>
      </div>

      {/* Dados do veículo */}
      <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Veículo</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Marca *</Label>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="Ex: Toyota"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Modelo *</Label>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="Ex: Corolla"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs">Ano *</Label>
            <Input
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
              placeholder="Ex: 2022"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5 max-w-xs">
          <Label className="text-white/70 text-xs">Tipo de pintura</Label>
          <Select value={tipoPinturaCodigo} onValueChange={setTipoPinturaCodigo}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Selecione (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Não informar</SelectItem>
              {tiposPintura.map((t) => (
                <SelectItem key={t.codigo} value={t.codigo}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Serviços */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Serviços a calcular
          </p>
          <Button size="sm" variant="outline" onClick={addServico}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar serviço
          </Button>
        </div>
        {servicos.map((svc, idx) => (
          <ServicoSearchRow
            key={idx}
            value={svc}
            onChange={(val) => updateServico(idx, val)}
            onRemove={() => removeServico(idx)}
            showRemove={servicos.length > 1}
          />
        ))}
      </section>

      <Button className="w-full" onClick={handleSimular} disabled={calcularServico.isPending}>
        <PlayCircle className="h-4 w-4 mr-2" />
        {calcularServico.isPending ? "Calculando…" : "Simular preços"}
      </Button>

      {/* Resultados */}
      {resultados.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Resultados</p>
          {resultados.map((r, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-4 space-y-3 ${
                r.status === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-center gap-2">
                {r.status === "ok" ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <span className="text-sm font-medium text-white">{r.servico_nome}</span>
                <Badge
                  variant="outline"
                  className={`ml-auto text-xs shrink-0 ${
                    r.status === "ok"
                      ? "border-emerald-500/40 text-emerald-400"
                      : "border-red-500/40 text-red-400"
                  }`}
                >
                  {r.status === "ok" ? "OK" : "Erro"}
                </Badge>
              </div>

              {r.status === "ok" && r.data && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md bg-white/5 p-3">
                    <p className="text-xs text-white/40 mb-1">Preço final</p>
                    <p className="text-base font-semibold text-emerald-400">
                      {formatCurrency(r.data.preco_final)}
                    </p>
                  </div>
                  <div className="rounded-md bg-white/5 p-3">
                    <p className="text-xs text-white/40 mb-1">Custo base</p>
                    <p className="text-base font-semibold text-white/70">
                      {formatCurrency(r.data.custo_total_base)}
                    </p>
                  </div>
                  <div className="rounded-md bg-white/5 p-3">
                    <p className="text-xs text-white/40 mb-1">Margem</p>
                    <p className="text-base font-semibold text-white/70">
                      {formatMargem(r.data.margem_ajustada)}
                    </p>
                  </div>
                  {r.data.teto_aplicado && (
                    <div className="col-span-3">
                      <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400">
                        Teto de benchmark aplicado
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {r.status === "erro" && (
                <p className="text-xs text-red-400">{r.erro}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
