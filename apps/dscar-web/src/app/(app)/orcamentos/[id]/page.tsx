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
  rascunho:      "text-muted-foreground bg-muted",
  enviado:       "text-info-400 bg-info-400/10",
  aprovado:      "text-success-400 bg-success-400/10",
  aprovado_parc: "text-warning-400 bg-warning-400/10",
  recusado:      "text-error-400 bg-error-400/10",
  expirado:      "text-warning-400 bg-warning-400/10",
  convertido_os: "text-foreground/60 bg-muted",
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
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground/70 hover:border-white/30 transition-colors text-sm w-full"
      >
        <Plus className="h-4 w-4" />
        <Package className="h-4 w-4" />
        Adicionar peça / intervenção
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nova Peça / Intervenção</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Área */}
        <div className="space-y-1.5">
          <Label className="text-foreground/70 text-xs">Área do veículo</Label>
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger className="bg-muted/50 border-border text-foreground">
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
          <Label className="text-foreground/70 text-xs">O que será feito</Label>
          <Select value={acao} onValueChange={(v) => setAcao(v as Acao)}>
            <SelectTrigger className="bg-muted/50 border-border text-foreground">
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
        <Label className="text-foreground/70 text-xs">Peça</Label>
        {pecaSelecionada ? (
          <div className="flex items-center justify-between bg-muted/50 border border-border rounded-md px-3 py-2">
            <span className="text-sm text-foreground">{pecaSelecionada.nome}</span>
            <button
              type="button"
              onClick={() => { setPecaSelecionada(null); setPecaSearch("") }}
              className="text-muted-foreground hover:text-foreground/70 text-xs"
            >
              trocar
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 pl-8"
                placeholder="Buscar peça (ex: parachoque, porta...)"
                value={pecaSearch}
                onChange={(e) => setPecaSearch(e.target.value)}
              />
            </div>
            {pecas.length > 0 && (
              <div className="rounded-md border border-border overflow-hidden max-h-40 overflow-y-auto">
                {pecas.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPecaSelecionada({ id: p.id, nome: p.nome }); setPecaSearch("") }}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50 border-b border-white/5 last:border-0 transition-colors"
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
          <Label className="text-foreground/70 text-xs">Quem fornece a peça</Label>
          <Select value={fornecimento} onValueChange={(v) => setFornecimento(v as Fornecimento)}>
            <SelectTrigger className="bg-muted/50 border-border text-foreground">
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
          <Label className="text-foreground/70 text-xs">Quantidade</Label>
          <Input
            type="number"
            min="1"
            className="bg-muted/50 border-border text-foreground"
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
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground/70 hover:border-white/30 transition-colors text-sm w-full"
      >
        <Plus className="h-4 w-4" />
        <Wrench className="h-4 w-4" />
        Adicionar serviço (alinhamento, polimento, lavagem...)
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Novo Serviço</p>

      <div className="space-y-1.5">
        <Label className="text-foreground/70 text-xs">Serviço</Label>
        {selecionado ? (
          <div className="flex items-center justify-between bg-muted/50 border border-border rounded-md px-3 py-2">
            <span className="text-sm text-foreground">{selecionado.name}</span>
            <button
              type="button"
              onClick={() => { setSelecionado(null); setSearch("") }}
              className="text-muted-foreground hover:text-foreground/70 text-xs"
            >
              trocar
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 pl-8"
                placeholder="Buscar serviço (ex: alinhamento, funilaria...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {servicos.length > 0 && (
              <div className="rounded-md border border-border overflow-hidden max-h-40 overflow-y-auto">
                {servicos.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelecionado({ id: s.id, name: s.name }); setSearch("") }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 border-b border-white/5 last:border-0 transition-colors"
                  >
                    <span className="text-sm text-foreground">{s.name}</span>
                    {s.suggested_price && (
                      <span className="text-xs text-muted-foreground">{formatBRL(s.suggested_price)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5 w-32">
        <Label className="text-foreground/70 text-xs">Quantidade</Label>
        <Input
          type="number"
          min="1"
          className="bg-muted/50 border-border text-foreground"
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

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">Carregando orçamento...</div>
  if (error || !orc) return <div className="p-6 text-error-400 text-sm">Orçamento não encontrado.</div>

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
          <Link href={"/orcamentos" as Route} className="text-muted-foreground hover:text-foreground/70 transition-colors shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <FileText className="h-5 w-5 text-primary-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-foreground">{orc.numero}</h1>
              <span className="text-muted-foreground text-sm">v{orc.versao}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[orc.status]}`}>
                {STATUS_LABELS[orc.status]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
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
              className="border-info-500/40 text-info-400 hover:bg-info-500/10"
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {enviando ? "Enviando..." : "Enviar"}
            </Button>
          )}
          {canRecusar && orc.status !== "rascunho" && (
            <Button variant="outline" size="sm" onClick={handleRecusar} disabled={recusando}
              className="border-error-500/40 text-error-400 hover:bg-error-500/10"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Recusar
            </Button>
          )}
          {canAprovar && (
            <Button size="sm" onClick={handleAprovar} disabled={aprovando}
              className="bg-success-600 hover:bg-success-700 text-foreground"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              {aprovando ? "Aprovando..." : "Aprovar → OS"}
            </Button>
          )}
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Subtotal</p>
          <p className="text-lg font-semibold text-foreground mt-1">{formatBRL(orc.subtotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Desconto</p>
          <p className="text-lg font-semibold text-error-400 mt-1">-{formatBRL(orc.desconto)}</p>
        </div>
        <div className="rounded-lg border border-primary-500/20 bg-primary-500/5 p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold text-primary-400 mt-1">{formatBRL(orc.total)}</p>
        </div>
      </div>

      {/* Intervenções por área */}
      {orc.areas.map((area) => {
        const ivs = orc.intervencoes.filter((iv) => iv.area_impacto === area.id)
        return (
          <div key={area.id} className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{area.titulo}</span>
              <span className="text-xs text-muted-foreground">{ivs.length} item{ivs.length !== 1 ? "s" : ""}</span>
            </div>
            {ivs.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
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
                      <td className="px-4 py-2.5 text-foreground/80">{iv.peca_nome || iv.peca_canonica}</td>
                      <td className="px-4 py-2.5 text-foreground/60">{ACAO_LABELS[iv.acao as Acao] ?? iv.acao}</td>
                      <td className="px-4 py-2.5 text-muted-foreground capitalize">{iv.fornecimento}</td>
                      <td className="px-4 py-2.5 text-right text-foreground/60">{parseFloat(iv.horas_mao_obra).toFixed(1)}h</td>
                      <td className="px-4 py-2.5 text-right text-foreground/60">{formatBRL(iv.valor_peca)}</td>
                      <td className="px-4 py-2.5 text-right text-foreground/60">{formatBRL(iv.valor_mao_obra)}</td>
                      <td className="px-4 py-2.5 text-right text-foreground/60">{formatBRL(iv.valor_insumos)}</td>
                      <td className="px-4 py-2.5 text-right text-foreground font-medium">{formatBRL(iv.preco_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-3 text-xs text-muted-foreground italic">Nenhuma peça nesta área.</p>
            )}
          </div>
        )
      })}

      {/* Itens adicionais (serviços) */}
      {orc.itens_adicionais.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
            <span className="text-sm font-medium text-foreground">Serviços Adicionais</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 text-left">Serviço</th>
                <th className="px-4 py-2 text-right">Qtd</th>
                <th className="px-4 py-2 text-right">Unitário</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orc.itens_adicionais.map((item) => (
                <tr key={item.id} className="border-b border-white/5">
                  <td className="px-4 py-2.5 text-foreground/80">{item.servico_nome || item.service_catalog}</td>
                  <td className="px-4 py-2.5 text-right text-foreground/60">{item.quantidade}</td>
                  <td className="px-4 py-2.5 text-right text-foreground/60">{formatBRL(item.preco_unitario)}</td>
                  <td className="px-4 py-2.5 text-right text-foreground font-medium">{formatBRL(item.preco_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Estado vazio */}
      {orc.intervencoes.length === 0 && orc.itens_adicionais.length === 0 && !isRascunho && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma peça ou serviço adicionado.</p>
        </div>
      )}

      {/* Formulários de adição — só em rascunho */}
      {isRascunho && (
        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adicionar itens ao orçamento</p>
          <AddIntervencaoForm orcamentoId={id} areas={orc.areas} />
          <AddItemAdicionalForm orcamentoId={id} />
        </div>
      )}
    </div>
  )
}
