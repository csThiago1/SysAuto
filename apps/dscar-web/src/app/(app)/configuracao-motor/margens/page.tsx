"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Percent, Plus, Trash2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useSession } from "next-auth/react"
import {
  useMargens,
  useMargemCreate,
  useMargemDelete,
  useMarkupsPeca,
  useMarkupPecaCreate,
  useMarkupPecaDelete,
} from "@/hooks/usePricingEngine"
import { useSegmentos } from "@/hooks/usePricingProfile"
import { usePecasCanonicas } from "@/hooks/usePricingCatalog"
import type { MargemOperacaoCreate, MarkupPecaCreate, TipoOperacao } from "@paddock/types"

const TIPO_OPERACAO_LABELS: Record<TipoOperacao, string> = {
  servico_mao_obra: "Serviço / Mão de obra",
  peca_revenda: "Peça (revenda)",
  insumo_comp: "Insumo complementar",
}

function formatMargem(val: string) {
  const n = parseFloat(val)
  return isNaN(n) ? val : `${(n * 100).toFixed(2)}%`
}

// ─── Margens por Segmento ─────────────────────────────────────────────────────

function MargensTab({ empresaId }: { empresaId: string }) {
  const { data: margens = [], isLoading } = useMargens(empresaId)
  const { data: segmentos = [] } = useSegmentos()
  const createMargem = useMargemCreate()
  const deleteMargem = useMargemDelete()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<MargemOperacaoCreate>>({
    empresa: empresaId,
    tipo_operacao: "servico_mao_obra",
    vigente_desde: new Date().toISOString().slice(0, 10),
  })

  const ativas = margens.filter((m) => m.is_active)

  async function handleSave() {
    if (!form.segmento || !form.margem_percentual || !form.tipo_operacao) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }
    try {
      await createMargem.mutateAsync(form as MargemOperacaoCreate)
      toast.success("Margem criada.")
      setOpen(false)
      setForm({
        empresa: empresaId,
        tipo_operacao: "servico_mao_obra",
        vigente_desde: new Date().toISOString().slice(0, 10),
      })
    } catch {
      toast.error("Erro ao criar margem.")
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMargem.mutateAsync(id)
      toast.success("Margem removida.")
    } catch {
      toast.error("Erro ao remover margem.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Margem base por segmento veicular e tipo de operação.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova margem
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Carregando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-foreground/60 text-xs">Segmento</TableHead>
                <TableHead className="text-foreground/60 text-xs">Tipo de Operação</TableHead>
                <TableHead className="text-foreground/60 text-xs text-right">Margem</TableHead>
                <TableHead className="text-foreground/60 text-xs">Vigência</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ativas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-8">
                    Nenhuma margem configurada.
                  </TableCell>
                </TableRow>
              )}
              {ativas.map((m) => (
                <TableRow key={m.id} className="border-border">
                  <TableCell className="text-sm text-foreground/80">{m.segmento}</TableCell>
                  <TableCell className="text-sm text-foreground/80">
                    {TIPO_OPERACAO_LABELS[m.tipo_operacao]}
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono text-success-400">
                    {formatMargem(m.margem_percentual)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.vigente_desde}
                    {m.vigente_ate ? ` → ${m.vigente_ate}` : " (sem vencimento)"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-error-400"
                      onClick={() => handleDelete(m.id)}
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-zinc-950 border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Nova Margem de Operação</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-foreground/70 text-xs">Segmento</Label>
              <Select
                value={form.segmento ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, segmento: v }))}
              >
                <SelectTrigger className="bg-muted/50 border-border text-foreground">
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent>
                  {segmentos.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground/70 text-xs">Tipo de Operação</Label>
              <Select
                value={form.tipo_operacao ?? "servico_mao_obra"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, tipo_operacao: v as TipoOperacao }))
                }
              >
                <SelectTrigger className="bg-muted/50 border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_OPERACAO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground/70 text-xs">
                Margem percentual (ex: 0.4000 = 40%)
              </Label>
              <Input
                className="bg-muted/50 border-border text-foreground"
                placeholder="0.4000"
                value={form.margem_percentual ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, margem_percentual: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/70 text-xs">Vigente desde</Label>
                <Input
                  type="date"
                  className="bg-muted/50 border-border text-foreground"
                  value={form.vigente_desde ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vigente_desde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/70 text-xs">Vigente até (opcional)</Label>
                <Input
                  type="date"
                  className="bg-muted/50 border-border text-foreground"
                  value={form.vigente_ate ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      vigente_ate: e.target.value || null,
                    }))
                  }
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={createMargem.isPending}>
              {createMargem.isPending ? "Salvando..." : "Criar Margem"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Markup por Peça ─────────────────────────────────────────────────────────

function MarkupPecaTab({ empresaId }: { empresaId: string }) {
  const { data: markups = [], isLoading } = useMarkupsPeca(empresaId)
  const createMarkup = useMarkupPecaCreate()
  const deleteMarkup = useMarkupPecaDelete()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<MarkupPecaCreate>>({
    empresa: empresaId,
    vigente_desde: new Date().toISOString().slice(0, 10),
  })

  // Peça canônica search
  const [pecaSearch, setPecaSearch] = useState("")
  const [pecaNome, setPecaNome] = useState("")
  const { data: pecas = [] } = usePecasCanonicas(pecaSearch.length >= 2 ? pecaSearch : undefined)

  const ativos = markups.filter((m) => m.is_active)

  async function handleSave() {
    if (!form.margem_percentual) {
      toast.error("Informe a margem percentual.")
      return
    }
    const temEspecifica = !!(form.peca_canonica)
    const temFaixa = !!(form.faixa_custo_min || form.faixa_custo_max)
    if (temEspecifica && temFaixa) {
      toast.error("Informe peça específica OU faixa de custo, não ambos.")
      return
    }
    if (!temEspecifica && !temFaixa) {
      toast.error("Informe peça específica OU faixa de custo.")
      return
    }
    try {
      await createMarkup.mutateAsync(form as MarkupPecaCreate)
      toast.success("Markup criado.")
      setOpen(false)
      setForm({
        empresa: empresaId,
        vigente_desde: new Date().toISOString().slice(0, 10),
      })
    } catch {
      toast.error("Erro ao criar markup.")
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMarkup.mutateAsync(id)
      toast.success("Markup removido.")
    } catch {
      toast.error("Erro ao remover markup.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Override de margem por peça específica ou faixa de custo base.
          Hierarquia: peça específica &gt; faixa &gt; margem do segmento.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo markup
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Carregando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-foreground/60 text-xs">Tipo</TableHead>
                <TableHead className="text-foreground/60 text-xs">Referência</TableHead>
                <TableHead className="text-foreground/60 text-xs text-right">Margem</TableHead>
                <TableHead className="text-foreground/60 text-xs">Vigência</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ativos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-8">
                    Nenhum markup configurado.
                  </TableCell>
                </TableRow>
              )}
              {ativos.map((m) => (
                <TableRow key={m.id} className="border-border">
                  <TableCell>
                    <Badge variant="outline" className="text-xs border-border text-foreground/60">
                      {m.peca_canonica ? "Peça específica" : "Faixa de custo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-foreground/80">
                    {m.peca_canonica
                      ? (m.peca_canonica_nome ?? m.peca_canonica)
                      : `R$${m.faixa_custo_min} – R$${m.faixa_custo_max}`}
                  </TableCell>
                  <TableCell className="text-sm text-right font-mono text-success-400">
                    {formatMargem(m.margem_percentual)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.vigente_desde}
                    {m.vigente_ate ? ` → ${m.vigente_ate}` : ""}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-error-400"
                      onClick={() => handleDelete(m.id)}
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-zinc-950 border-border">
          <SheetHeader>
            <SheetTitle className="text-foreground">Novo Markup por Peça</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <p className="text-xs text-muted-foreground">
              Informe a peça canônica OU a faixa de custo, nunca ambos.
            </p>

            <div className="space-y-1.5">
              <Label className="text-foreground/70 text-xs">Peça canônica (opcional)</Label>
              {pecaNome ? (
                <div className="flex items-center justify-between bg-muted/50 border border-border rounded-md px-3 py-2">
                  <span className="text-sm text-foreground">{pecaNome}</span>
                  <button
                    type="button"
                    onClick={() => { setPecaNome(""); setPecaSearch(""); setForm((f) => ({ ...f, peca_canonica: null })) }}
                    className="text-muted-foreground hover:text-foreground/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50 pl-8"
                      placeholder="Buscar peça (ou deixar em branco para faixa)"
                      value={pecaSearch}
                      onChange={(e) => setPecaSearch(e.target.value)}
                    />
                  </div>
                  {pecas.length > 0 && (
                    <div className="rounded-md border border-border overflow-hidden max-h-40 overflow-y-auto">
                      {pecas.slice(0, 6).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, peca_canonica: p.id }))
                            setPecaNome(p.nome)
                            setPecaSearch("")
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/50 border-b border-white/5 last:border-0 transition-colors"
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
              <div className="space-y-1.5">
                <Label className="text-foreground/70 text-xs">Faixa custo mín (R$)</Label>
                <Input
                  className="bg-muted/50 border-border text-foreground"
                  placeholder="0.00"
                  value={form.faixa_custo_min ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, faixa_custo_min: e.target.value || null }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/70 text-xs">Faixa custo máx (R$)</Label>
                <Input
                  className="bg-muted/50 border-border text-foreground"
                  placeholder="0.00"
                  value={form.faixa_custo_max ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, faixa_custo_max: e.target.value || null }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground/70 text-xs">
                Margem percentual (ex: 0.3500 = 35%)
              </Label>
              <Input
                className="bg-muted/50 border-border text-foreground"
                placeholder="0.3500"
                value={form.margem_percentual ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, margem_percentual: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-foreground/70 text-xs">Vigente desde</Label>
                <Input
                  type="date"
                  className="bg-muted/50 border-border text-foreground"
                  value={form.vigente_desde ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vigente_desde: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/70 text-xs">Vigente até (opcional)</Label>
                <Input
                  type="date"
                  className="bg-muted/50 border-border text-foreground"
                  value={form.vigente_ate ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vigente_ate: e.target.value || null }))
                  }
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleSave} disabled={createMarkup.isPending}>
              {createMarkup.isPending ? "Salvando..." : "Criar Markup"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MargensPage() {
  const { data: session } = useSession()
  const empresaId = (session as { empresaId?: string } | null)?.empresaId ?? ""

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Percent className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Margens</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Margens de operação e markups por peça para o motor de precificação.
          </p>
        </div>
      </div>

      <Tabs defaultValue="margens">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="margens" className="text-xs">
            Por segmento × operação
          </TabsTrigger>
          <TabsTrigger value="markup" className="text-xs">
            Markup por peça
          </TabsTrigger>
        </TabsList>
        <TabsContent value="margens" className="mt-4">
          <MargensTab empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="markup" className="mt-4">
          <MarkupPecaTab empresaId={empresaId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
