"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, FileText, CheckCircle, XCircle, Send, Copy, Plus, Search, Wrench, Package } from "lucide-react"
import Link from "next/link"
import type { Route } from "next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useOrcamento,
  useEnviarOrcamento,
  useRecusarOrcamento,
  useAprovarOrcamento,
  useNovaVersaoOrcamento,
  useAdicionarIntervencao,
  useAdicionarItemAdicional,
} from "@/hooks/useQuotes"
import { usePecasCanonicas } from "@/hooks/usePricingCatalog"
import { useServiceCatalog } from "@/hooks/useServiceCatalog"
import type { Acao, Fornecimento, StatusOrcamento } from "@paddock/types"

// ── Labels e cores ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<StatusOrcamento, string> = {
  rascunho:      "Rascunho",
  enviado:       "Enviado",
  aprovado:      "Aprovado",
  aprovado_parc: "Aprovado Parcial",
  recusado:      "Recusado",
  expirado:      "Expirado",
  convertido_os: "Convertido em OS",
}

const STATUS_COLORS: Record<StatusOrcamento, string> = {
  rascunho:      "text-white/50 bg-white/10",
  enviado:       "text-blue-400 bg-blue-400/10",
  aprovado:      "text-emerald-400 bg-emerald-400/10",
  aprovado_parc: "text-yellow-400 bg-yellow-400/10",
  recusado:      "text-red-400 bg-red-400/10",
  expirado:      "text-orange-400 bg-orange-400/10",
  convertido_os: "text-purple-400 bg-purple-400/10",
}

const ACAO_LABELS: Record<Acao, string> = {
  trocar:             "Trocar",
  reparar:            "Reparar",
  pintar:             "Pintar",
  remocao_instalacao: "Remoção e Instalação",
}

const formatBRL = (v: string | number) =>
  parseFloat(String(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// ── Formulário de Intervenção (Peça) ──────────────────────────────────────────

function AddIntervencaoForm({
  orcamentoId,
  areas,
}: {
  orcamentoId: string
  areas: { id: string; titulo: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [pecaSearch, setPecaSearch] = useState("")
  const [pecaSelecionada, setPecaSelecionada] = useState<{ id: string; nome: string } | null>(null)
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "")
  const [acao, setAcao] = useState<Acao>("trocar")
  const [fornecimento, setFornecimento] = useState<Fornecimento>("oficina")
  const [quantidade, setQuantidade] = useState("1")

  const { data: pecasData } = usePecasCanonicas(pecaSearch.length >= 2 ? pecaSearch : undefined)
  const pecas = pecasData ?? []

  const { mutateAsync: adicionar, isPending } = useAdicionarIntervencao(orcamentoId)

  async function handleAdd() {
    if (!pecaSelecionada || !areaId) {
      toast.error("Selecione a área e a peça.")
      return
    }
    try {
      await adicionar({
        area_impacto_id: areaId,
        peca_canonica_id: pecaSelecionada.id,
        acao,
        fornecimento,
        quantidade: parseInt(quantidade),
      })
      toast.success("Peça adicionada ao orçamento.")
      setOpen(false)
      setPecaSelecionada(null)
      setPecaSearch("")
      setAcao("trocar")
      setQuantidade("1")
    } catch {
      toast.error("Erro ao adicionar peça.")
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-white/15 text-white/40 hover:text-white/70 hover:border-white/30 transition-colors text-sm w-full"
      >
        <Plus className="h-4 w-4" />
        <Package className="h-4 w-4" />
        Adicionar peça / intervenção
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Nova Peça / Intervenção</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Área */}
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">Área do veículo</Label>
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Selecione a área" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.titulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ação */}
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">O que será feito</Label>
          <Select value={acao} onValueChange={(v) => setAcao(v as Acao)}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(ACAO_LABELS) as [Acao, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Busca de peça */}
      <div className="space-y-1.5">
        <Label className="text-white/70 text-xs">Peça</Label>
        {pecaSelecionada ? (
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
            <span className="text-sm text-white">{pecaSelecionada.nome}</span>
            <button
              type="button"
              onClick={() => { setPecaSelecionada(null); setPecaSearch("") }}
              className="text-white/30 hover:text-white/70 text-xs"
            >
              trocar
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <Input
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-8"
                placeholder="Buscar peça (ex: parachoque, porta...)"
                value={pecaSearch}
                onChange={(e) => setPecaSearch(e.target.value)}
              />
            </div>
            {pecas.length > 0 && (
              <div className="rounded-md border border-white/10 overflow-hidden max-h-40 overflow-y-auto">
                {pecas.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPecaSelecionada({ id: p.id, nome: p.nome }); setPecaSearch("") }}
                    className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Fornecimento */}
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">Quem fornece a peça</Label>
          <Select value={fornecimento} onValueChange={(v) => setFornecimento(v as Fornecimento)}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oficina">Oficina fornece</SelectItem>
              <SelectItem value="seguradora">Seguradora fornece</SelectItem>
              <SelectItem value="cliente">Cliente traz</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quantidade */}
        <div className="space-y-1.5">
          <Label className="text-white/70 text-xs">Quantidade</Label>
          <Input
            type="number"
            min="1"
            className="bg-white/5 border-white/10 text-white"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleAdd} disabled={isPending || !pecaSelecionada}>
          {isPending ? "Adicionando..." : "Adicionar"}
        </Button>
      </div>
    </div>
  )
}

// ── Formulário de Serviço Adicional ───────────────────────────────────────────

function AddItemAdicionalForm({ orcamentoId }: { orcamentoId: string }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selecionado, setSelecionado] = useState<{ id: string; name: string } | null>(null)
  const [quantidade, setQuantidade] = useState("1")

  const { data: catalogData } = useServiceCatalog(search.length >= 2 ? { search } : undefined)
  const servicos = catalogData?.results ?? []

  const { mutateAsync: adicionar, isPending } = useAdicionarItemAdicional(orcamentoId)

  async function handleAdd() {
    if (!selecionado) {
      toast.error("Selecione o serviço.")
      return
    }
    try {
      await adicionar({
        service_catalog_id: selecionado.id,
        quantidade: parseInt(quantidade),
      })
      toast.success("Serviço adicionado.")
      setOpen(false)
      setSelecionado(null)
      setSearch("")
      setQuantidade("1")
    } catch {
      toast.error("Erro ao adicionar serviço.")
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-white/15 text-white/40 hover:text-white/70 hover:border-white/30 transition-colors text-sm w-full"
      >
        <Plus className="h-4 w-4" />
        <Wrench className="h-4 w-4" />
        Adicionar serviço (alinhamento, polimento, lavagem...)
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Novo Serviço</p>

      <div className="space-y-1.5">
        <Label className="text-white/70 text-xs">Serviço</Label>
        {selecionado ? (
          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-md px-3 py-2">
            <span className="text-sm text-white">{selecionado.name}</span>
            <button
              type="button"
              onClick={() => { setSelecionado(null); setSearch("") }}
              className="text-white/30 hover:text-white/70 text-xs"
            >
              trocar
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <Input
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-8"
                placeholder="Buscar serviço (ex: alinhamento, funilaria...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {servicos.length > 0 && (
              <div className="rounded-md border border-white/10 overflow-hidden max-h-40 overflow-y-auto">
                {servicos.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelecionado({ id: s.id, name: s.name }); setSearch("") }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                  >
                    <span className="text-sm text-white">{s.name}</span>
                    {s.suggested_price && (
                      <span className="text-xs text-white/40">{formatBRL(s.suggested_price)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5 w-32">
        <Label className="text-white/70 text-xs">Quantidade</Label>
        <Input
          type="number"
          min="1"
          className="bg-white/5 border-white/10 text-white"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleAdd} disabled={isPending || !selecionado}>
          {isPending ? "Adicionando..." : "Adicionar"}
        </Button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function OrcamentoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: orc, isLoading, error } = useOrcamento(id)
  const { mutateAsync: enviar,     isPending: enviando }  = useEnviarOrcamento(id)
  const { mutateAsync: recusar,    isPending: recusando } = useRecusarOrcamento(id)
  const { mutateAsync: aprovar,    isPending: aprovando } = useAprovarOrcamento(id)
  const { mutateAsync: novaVersao, isPending: clonando }  = useNovaVersaoOrcamento(id)

  if (isLoading) return <div className="p-6 text-white/40 text-sm">Carregando orçamento...</div>
  if (error || !orc) return <div className="p-6 text-red-400 text-sm">Orçamento não encontrado.</div>

  const isRascunho = orc.status === "rascunho"
  const canEnviar  = isRascunho
  const canAprovar = ["rascunho", "enviado"].includes(orc.status)
  const canRecusar = !["convertido_os", "expirado"].includes(orc.status)
  const canClone   = ["aprovado", "aprovado_parc"].includes(orc.status)

  async function handleEnviar() {
    try {
      await enviar()
      toast.success("Orçamento enviado ao cliente.")
    } catch {
      toast.error("Erro ao enviar orçamento.")
    }
  }

  async function handleRecusar() {
    try {
      await recusar()
      toast.success("Orçamento recusado.")
    } catch {
      toast.error("Erro ao recusar orçamento.")
    }
  }

  async function handleAprovar() {
    try {
      const res = await aprovar({ intervencoes_ids: null, itens_adicionais_ids: null, areas_negadas: null })
      toast.success(`OS #${res.os_number} criada com sucesso!`)
      router.push(`/os/${res.os_id}` as Route)
    } catch {
      toast.error("Erro ao aprovar orçamento.")
    }
  }

  async function handleNovaVersao() {
    try {
      const nova = await novaVersao()
      toast.success(`Versão ${nova.versao} criada.`)
      router.push(`/orcamentos/${nova.id}` as Route)
    } catch {
      toast.error("Erro ao criar nova versão.")
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={"/orcamentos" as Route} className="text-white/40 hover:text-white/70 transition-colors shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <FileText className="h-5 w-5 text-primary-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-white">{orc.numero}</h1>
              <span className="text-white/40 text-sm">v{orc.versao}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[orc.status]}`}>
                {STATUS_LABELS[orc.status]}
              </span>
            </div>
            <p className="text-xs text-white/40 mt-0.5 truncate">
              {orc.customer_nome} · {orc.veiculo_marca} {orc.veiculo_modelo} {orc.veiculo_ano}
              {orc.veiculo_placa && ` · ${orc.veiculo_placa}`}
            </p>
          </div>
        </div>

        {/* Ações de fluxo */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {canClone && (
            <Button variant="outline" size="sm" onClick={handleNovaVersao} disabled={clonando}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Nova versão
            </Button>
          )}
          {canEnviar && (
            <Button variant="outline" size="sm" onClick={handleEnviar} disabled={enviando}
              className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {enviando ? "Enviando..." : "Enviar"}
            </Button>
          )}
          {canRecusar && orc.status !== "rascunho" && (
            <Button variant="outline" size="sm" onClick={handleRecusar} disabled={recusando}
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Recusar
            </Button>
          )}
          {canAprovar && (
            <Button size="sm" onClick={handleAprovar} disabled={aprovando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              {aprovando ? "Aprovando..." : "Aprovar → OS"}
            </Button>
          )}
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40">Subtotal</p>
          <p className="text-lg font-semibold text-white mt-1">{formatBRL(orc.subtotal)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-white/40">Desconto</p>
          <p className="text-lg font-semibold text-red-400 mt-1">-{formatBRL(orc.desconto)}</p>
        </div>
        <div className="rounded-lg border border-primary-500/20 bg-primary-500/5 p-4">
          <p className="text-xs text-white/40">Total</p>
          <p className="text-lg font-semibold text-primary-400 mt-1">{formatBRL(orc.total)}</p>
        </div>
      </div>

      {/* Intervenções por área */}
      {orc.areas.map((area) => {
        const ivs = orc.intervencoes.filter((iv) => iv.area_impacto === area.id)
        return (
          <div key={area.id} className="rounded-lg border border-white/10 overflow-hidden">
            <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-medium text-white">{area.titulo}</span>
              <span className="text-xs text-white/40">{ivs.length} item{ivs.length !== 1 ? "s" : ""}</span>
            </div>
            {ivs.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/40">
                    <th className="px-4 py-2 text-left">Peça</th>
                    <th className="px-4 py-2 text-left">Ação</th>
                    <th className="px-4 py-2 text-left">Fornecimento</th>
                    <th className="px-4 py-2 text-right">Horas MO</th>
                    <th className="px-4 py-2 text-right">Peça</th>
                    <th className="px-4 py-2 text-right">MO</th>
                    <th className="px-4 py-2 text-right">Insumos</th>
                    <th className="px-4 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ivs.map((iv) => (
                    <tr key={iv.id} className="border-b border-white/5">
                      <td className="px-4 py-2.5 text-white/80">{iv.peca_nome || iv.peca_canonica}</td>
                      <td className="px-4 py-2.5 text-white/60">{ACAO_LABELS[iv.acao as Acao] ?? iv.acao}</td>
                      <td className="px-4 py-2.5 text-white/50 capitalize">{iv.fornecimento}</td>
                      <td className="px-4 py-2.5 text-right text-white/60">{parseFloat(iv.horas_mao_obra).toFixed(1)}h</td>
                      <td className="px-4 py-2.5 text-right text-white/60">{formatBRL(iv.valor_peca)}</td>
                      <td className="px-4 py-2.5 text-right text-white/60">{formatBRL(iv.valor_mao_obra)}</td>
                      <td className="px-4 py-2.5 text-right text-white/60">{formatBRL(iv.valor_insumos)}</td>
                      <td className="px-4 py-2.5 text-right text-white font-medium">{formatBRL(iv.preco_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-3 text-xs text-white/30 italic">Nenhuma peça nesta área.</p>
            )}
          </div>
        )
      })}

      {/* Itens adicionais (serviços) */}
      {orc.itens_adicionais.length > 0 && (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 bg-white/5 border-b border-white/10">
            <span className="text-sm font-medium text-white">Serviços Adicionais</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="px-4 py-2 text-left">Serviço</th>
                <th className="px-4 py-2 text-right">Qtd</th>
                <th className="px-4 py-2 text-right">Unitário</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orc.itens_adicionais.map((item) => (
                <tr key={item.id} className="border-b border-white/5">
                  <td className="px-4 py-2.5 text-white/80">{item.servico_nome || item.service_catalog}</td>
                  <td className="px-4 py-2.5 text-right text-white/60">{item.quantidade}</td>
                  <td className="px-4 py-2.5 text-right text-white/60">{formatBRL(item.preco_unitario)}</td>
                  <td className="px-4 py-2.5 text-right text-white font-medium">{formatBRL(item.preco_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Estado vazio */}
      {orc.intervencoes.length === 0 && orc.itens_adicionais.length === 0 && !isRascunho && (
        <div className="rounded-lg border border-dashed border-white/10 p-8 text-center">
          <p className="text-sm text-white/40">Nenhuma peça ou serviço adicionado.</p>
        </div>
      )}

      {/* Formulários de adição — só em rascunho */}
      {isRascunho && (
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold text-white/30 uppercase tracking-wider">Adicionar itens ao orçamento</p>
          <AddIntervencaoForm orcamentoId={id} areas={orc.areas} />
          <AddItemAdicionalForm orcamentoId={id} />
        </div>
      )}
    </div>
  )
}
