"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  SlidersHorizontal,
  Clock,
  Settings2,
  Layers,
  FlaskConical,
  ExternalLink,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/PermissionGate"
import {
  useCustosHoraFallback,
  useCreateCustoHoraFallback,
  useParametrosCustoHora,
  useCreateParametroCustoHora,
  useParametrosRateio,
  useCreateParametroRateio,
  useDebugCustoHora,
} from "@/hooks/usePricingCost"
import { useCategoriasMaoObra } from "@/hooks/usePricingCatalog"
import { useMinhaEmpresaId } from "@/hooks/usePricingProfile"
import type { CustoHoraFallbackCreate, ParametroCustoHoraCreate, ParametroRateioCreate } from "@paddock/types"
import Link from "next/link"
import type { Route } from "next"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDecimalPercent(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return `${(num * 100).toFixed(2)}%`
}

// ─── Aba 1: Custo/Hora Fallback ───────────────────────────────────────────────

function AbaFallback({ empresaId }: { empresaId: string }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState<Partial<CustoHoraFallbackCreate>>({
    vigente_desde: new Date().toISOString().split("T")[0],
    vigente_ate: null,
    valor_hora: "",
    motivo: "",
  })

  const { data, isLoading } = useCustosHoraFallback()
  const createMutation = useCreateCustoHoraFallback()
  const { data: categorias = [] } = useCategoriasMaoObra()

  const fallbacks = data?.results ?? []

  async function handleSave() {
    if (!form.categoria || !form.vigente_desde || !form.valor_hora) {
      toast.error("Preencha todos os campos obrigatórios.")
      return
    }
    try {
      await createMutation.mutateAsync({ ...form, empresa: empresaId } as CustoHoraFallbackCreate)
      toast.success("Fallback cadastrado com sucesso.")
      setSheetOpen(false)
      setForm({ vigente_desde: new Date().toISOString().split("T")[0], vigente_ate: null, valor_hora: "", motivo: "" })
    } catch {
      toast.error("Erro ao cadastrar fallback. Tente novamente.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Custo/Hora por Categoria</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Valor direto utilizado quando o módulo RH não possui dados completos para a categoria.
          </p>
        </div>
        <PermissionGate role="ADMIN">
          <Button
            size="sm"
            onClick={() => setSheetOpen(true)}
            className="bg-primary hover:bg-primary/90"
          >
            Cadastrar fallback
          </Button>
        </PermissionGate>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Carregando...</p>
      ) : fallbacks.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-8 text-center">
          <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhum fallback cadastrado.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Enquanto o módulo RH não tem dados, cadastre um valor de referência por categoria.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground text-xs">Categoria</TableHead>
                <TableHead className="text-muted-foreground text-xs">Valor/hora</TableHead>
                <TableHead className="text-muted-foreground text-xs">Vigência</TableHead>
                <TableHead className="text-muted-foreground text-xs">Motivo</TableHead>
                <TableHead className="text-muted-foreground text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fallbacks.map((fb) => (
                <TableRow key={fb.id} className="border-border">
                  <TableCell className="text-sm text-foreground font-medium">
                    {fb.categoria_nome ?? fb.categoria}
                  </TableCell>
                  <TableCell className="text-sm text-foreground font-mono">
                    R$ {parseFloat(fb.valor_hora).toFixed(2)}/h
                  </TableCell>
                  <TableCell className="text-xs text-foreground/60">
                    {fb.vigente_desde}
                    {fb.vigente_ate ? ` → ${fb.vigente_ate}` : " → atual"}
                  </TableCell>
                  <TableCell className="text-xs text-foreground/60 max-w-[200px] truncate">
                    {fb.motivo || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        fb.is_active
                          ? "border-success-600 text-success-400 text-xs"
                          : "border-border text-muted-foreground text-xs"
                      }
                    >
                      {fb.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-card border-border text-foreground w-[420px]">
          <SheetHeader>
            <SheetTitle className="text-foreground">Novo Fallback de Custo/Hora</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-foreground/60">Categoria de mão de obra</Label>
              <select
                className="w-full text-sm bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.categoria ?? ""}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                <option value="">Selecione a categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-foreground/60">Vigente desde</Label>
                <Input
                  type="date"
                  value={form.vigente_desde ?? ""}
                  onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })}
                  className="bg-muted/50 border-border text-foreground text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-foreground/60">Vigente até (opcional)</Label>
                <Input
                  type="date"
                  value={form.vigente_ate ?? ""}
                  onChange={(e) => setForm({ ...form, vigente_ate: e.target.value || null })}
                  className="bg-muted/50 border-border text-foreground text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-foreground/60">Valor por hora (R$)</Label>
              <Input
                placeholder="Ex: 95.00"
                value={form.valor_hora ?? ""}
                onChange={(e) => setForm({ ...form, valor_hora: e.target.value })}
                className="bg-muted/50 border-border text-foreground text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-foreground/60">Motivo (opcional)</Label>
              <Input
                placeholder="Ex: Aguardando integração RH"
                value={form.motivo ?? ""}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                className="bg-muted/50 border-border text-foreground text-sm"
              />
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90 mt-2"
              onClick={handleSave}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Aba 2: Parâmetros ────────────────────────────────────────────────────────

function AbaParametros({ empresaId }: { empresaId: string }) {
  const { data: rateioData } = useParametrosRateio()
  const { data: custoHoraData } = useParametrosCustoHora()
  const createRateio = useCreateParametroRateio()
  const createCustoHora = useCreateParametroCustoHora()

  const [rateioForm, setRateioForm] = useState<Partial<ParametroRateioCreate>>({
    vigente_desde: new Date().toISOString().split("T")[0],
    vigente_ate: null,
    horas_produtivas_mes: "168.00",
    metodo: "por_hora",
    observacoes: "",
  })
  const [custoHoraForm, setCustoHoraForm] = useState<Partial<ParametroCustoHoraCreate>>({
    vigente_desde: new Date().toISOString().split("T")[0],
    vigente_ate: null,
    provisao_13_ferias: "0.1389",
    multa_fgts_rescisao: "0.0320",
    beneficios_por_funcionario: "0.00",
    horas_produtivas_mes: "168.00",
    observacoes: "",
  })
  const parametrosRateio = rateioData?.results ?? []
  const parametrosCustoHora = custoHoraData?.results ?? []

  async function handleSaveRateio() {
    try {
      await createRateio.mutateAsync({ ...rateioForm, empresa: empresaId } as ParametroRateioCreate)
      toast.success("Parâmetro de rateio salvo. Só afeta orçamentos novos.")
    } catch {
      toast.error("Erro ao salvar parâmetro de rateio.")
    }
  }

  async function handleSaveCustoHora() {
    try {
      await createCustoHora.mutateAsync({ ...custoHoraForm, empresa: empresaId } as ParametroCustoHoraCreate)
      toast.success("Parâmetro de custo/hora salvo. Só afeta orçamentos novos.")
    } catch {
      toast.error("Erro ao salvar parâmetro de custo/hora.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-info-600/20 bg-info-600/5 px-4 py-3">
        <p className="text-xs text-info-400">
          Alterações de parâmetros só afetam <strong>orçamentos criados após a data de vigência</strong>.
          Orçamentos existentes não são recalculados automaticamente.
        </p>
      </div>


      {/* Parâmetro de Rateio */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Parâmetro de Rateio</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Horas produtivas mensais e método de rateio de despesas fixas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">Horas produtivas/mês</Label>
            <Input
              type="number"
              step="0.5"
              value={rateioForm.horas_produtivas_mes ?? "168.00"}
              onChange={(e) => setRateioForm({ ...rateioForm, horas_produtivas_mes: e.target.value })}
              className="bg-muted/50 border-border text-foreground text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">Método</Label>
            <select
              value={rateioForm.metodo ?? "por_hora"}
              onChange={(e) => setRateioForm({ ...rateioForm, metodo: e.target.value as "por_hora" | "por_os" })}
              className="w-full rounded-md bg-muted/50 border border-border text-foreground text-sm px-3 py-2"
            >
              <option value="por_hora">Por hora produtiva</option>
              <option value="por_os">Por OS concluída</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">Vigente desde</Label>
            <Input
              type="date"
              value={rateioForm.vigente_desde ?? ""}
              onChange={(e) => setRateioForm({ ...rateioForm, vigente_desde: e.target.value })}
              className="bg-muted/50 border-border text-foreground text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">Vigente até</Label>
            <Input
              type="date"
              value={rateioForm.vigente_ate ?? ""}
              onChange={(e) => setRateioForm({ ...rateioForm, vigente_ate: e.target.value || null })}
              className="bg-muted/50 border-border text-foreground text-sm"
            />
          </div>
        </div>
        <PermissionGate role="ADMIN">
          <Button
            size="sm"
            onClick={handleSaveRateio}
            disabled={createRateio.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {createRateio.isPending ? "Salvando..." : "Salvar parâmetro de rateio"}
          </Button>
        </PermissionGate>

        {parametrosRateio.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Histórico de parâmetros</p>
            {parametrosRateio.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1 text-xs text-foreground/60">
                <span className="font-mono">{p.horas_produtivas_mes}h/mês</span>
                <span>·</span>
                <span>{p.metodo === "por_hora" ? "Por hora" : "Por OS"}</span>
                <span>·</span>
                <span>{p.vigente_desde}</span>
                {p.vigente_ate && <span>→ {p.vigente_ate}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parâmetro de Custo Hora */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Parâmetro de Custo/Hora</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Encargos e benefícios que compõem o custo real da hora sobre o salário bruto.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">
              Provisão 13º + férias (fração)
              <span className="ml-1 text-muted-foreground">{formatDecimalPercent(custoHoraForm.provisao_13_ferias ?? "0.1389")}</span>
            </Label>
            <Input
              type="number"
              step="0.0001"
              value={custoHoraForm.provisao_13_ferias ?? "0.1389"}
              onChange={(e) => setCustoHoraForm({ ...custoHoraForm, provisao_13_ferias: e.target.value })}
              className="bg-muted/50 border-border text-foreground text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">
              Multa FGTS rescisão (fração)
              <span className="ml-1 text-muted-foreground">{formatDecimalPercent(custoHoraForm.multa_fgts_rescisao ?? "0.0320")}</span>
            </Label>
            <Input
              type="number"
              step="0.0001"
              value={custoHoraForm.multa_fgts_rescisao ?? "0.0320"}
              onChange={(e) => setCustoHoraForm({ ...custoHoraForm, multa_fgts_rescisao: e.target.value })}
              className="bg-muted/50 border-border text-foreground text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">Benefícios por funcionário (R$/mês)</Label>
            <Input
              type="number"
              step="0.01"
              value={custoHoraForm.beneficios_por_funcionario ?? "0.00"}
              onChange={(e) => setCustoHoraForm({ ...custoHoraForm, beneficios_por_funcionario: e.target.value })}
              className="bg-muted/50 border-border text-foreground text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">Horas produtivas individuais/mês</Label>
            <Input
              type="number"
              step="0.5"
              value={custoHoraForm.horas_produtivas_mes ?? "168.00"}
              onChange={(e) => setCustoHoraForm({ ...custoHoraForm, horas_produtivas_mes: e.target.value })}
              className="bg-muted/50 border-border text-foreground text-sm font-mono"
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-foreground/60">Vigente desde</Label>
            <Input
              type="date"
              value={custoHoraForm.vigente_desde ?? ""}
              onChange={(e) => setCustoHoraForm({ ...custoHoraForm, vigente_desde: e.target.value })}
              className="bg-muted/50 border-border text-foreground text-sm max-w-[200px]"
            />
          </div>
        </div>
        <PermissionGate role="ADMIN">
          <Button
            size="sm"
            onClick={handleSaveCustoHora}
            disabled={createCustoHora.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {createCustoHora.isPending ? "Salvando..." : "Salvar parâmetro de custo/hora"}
          </Button>
        </PermissionGate>

        {parametrosCustoHora.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Histórico</p>
            {parametrosCustoHora.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1 text-xs text-foreground/60 font-mono">
                <span>{formatDecimalPercent(p.provisao_13_ferias)} 13º/férias</span>
                <span>·</span>
                <span>{p.horas_produtivas_mes}h/mês</span>
                <span>·</span>
                <span>desde {p.vigente_desde}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Aba 3: Despesas ──────────────────────────────────────────────────────────

function AbaDespesas() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/50 p-6 text-center space-y-3">
        <Layers className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Despesas Recorrentes</h3>
          <p className="text-xs text-muted-foreground mt-1">
            As despesas fixas da oficina (aluguel, energia, etc.) são gerenciadas no módulo financeiro.
          </p>
        </div>
        <Link href={"/financeiro/contas-pagar" as Route}>
          <Button variant="outline" size="sm" className="border-border text-foreground/70 hover:text-foreground gap-2">
            <ExternalLink className="h-3.5 w-3.5" />
            Ir para Contas a Pagar
          </Button>
        </Link>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        O Motor de Orçamentos lê automaticamente as despesas com vigência ativa para o mês de referência.
      </p>
    </div>
  )
}

// ─── Aba 4: Simulação (ADMIN+) ────────────────────────────────────────────────

function AbaSimulacao({ empresaId }: { empresaId: string }) {
  const [form, setForm] = useState({
    categoria_codigo: "",
    data: new Date().toISOString().split("T")[0],
  })
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null)

  const debugMutation = useDebugCustoHora()

  async function handleSimular() {
    if (!form.categoria_codigo || !form.data) {
      toast.error("Preencha todos os campos.")
      return
    }
    try {
      const res = await debugMutation.mutateAsync({ ...form, empresa_id: empresaId })
      setResultado(res as unknown as Record<string, unknown>)
    } catch {
      toast.error("Erro ao simular custo/hora. Verifique os dados.")
      setResultado(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning-600/20 bg-warning-600/5 px-4 py-3">
        <p className="text-xs text-warning-400">
          Endpoint de diagnóstico. Retorna o custo/hora calculado para a categoria+data+empresa
          informadas, incluindo decomposição completa da fórmula.
        </p>
      </div>

      <div className="space-y-3 max-w-sm">
        <div className="space-y-1">
          <Label className="text-xs text-foreground/60">Código da categoria (ex: funileiro)</Label>
          <Input
            placeholder="Ex: funileiro, pintor..."
            value={form.categoria_codigo}
            onChange={(e) => setForm({ ...form, categoria_codigo: e.target.value })}
            className="bg-muted/50 border-border text-foreground text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-foreground/60">Data de referência</Label>
          <Input
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            className="bg-muted/50 border-border text-foreground text-sm"
          />
        </div>
        <Button
          onClick={handleSimular}
          disabled={debugMutation.isPending}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {debugMutation.isPending ? "Calculando..." : "Simular custo/hora"}
        </Button>
      </div>

      {resultado !== null && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
          <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">Resultado</p>
          <pre className="text-xs text-foreground/80 whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(resultado, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracaoMotorCustosPage() {
  const empresaId = useMinhaEmpresaId()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Configuração do Motor — Custos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Parâmetros de custo/hora, rateio de despesas e diagnóstico.
          </p>
        </div>
      </div>

      <Tabs defaultValue="custo-hora" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="custo-hora" className="text-xs data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Custo/Hora
          </TabsTrigger>
          <TabsTrigger value="parametros" className="text-xs data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Parâmetros
          </TabsTrigger>
          <TabsTrigger value="despesas" className="text-xs data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground">
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Despesas
          </TabsTrigger>
          <PermissionGate role="ADMIN">
            <TabsTrigger value="simulacao" className="text-xs data-[state=active]:bg-muted data-[state=active]:text-foreground text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              Simulação
            </TabsTrigger>
          </PermissionGate>
        </TabsList>

        <TabsContent value="custo-hora">
          <AbaFallback empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="parametros">
          <AbaParametros empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="despesas">
          <AbaDespesas />
        </TabsContent>
        <TabsContent value="simulacao">
          <PermissionGate role="ADMIN">
            <AbaSimulacao empresaId={empresaId} />
          </PermissionGate>
        </TabsContent>
      </Tabs>
    </div>
  )
}
