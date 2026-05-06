"use client"

import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Layers, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSnapshot } from "@/hooks/usePricingEngine"

function formatCurrency(val: string | null | undefined) {
  if (!val) return "—"
  const n = parseFloat(val)
  return isNaN(n) ? val : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatMargem(val: string | null | undefined) {
  if (!val) return "—"
  const n = parseFloat(val)
  return isNaN(n) ? val : `${(n * 100).toFixed(2)}%`
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground font-mono">{value}</span>
    </div>
  )
}

export default function SnapshotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: snap, isLoading } = useSnapshot(id)

  if (isLoading) {
    return (
      <div className="p-6 text-xs text-muted-foreground">Carregando snapshot…</div>
    )
  }

  if (!snap) {
    return (
      <div className="p-6 text-xs text-red-400">Snapshot não encontrado.</div>
    )
  }

  const ctx = snap.contexto as {
    veiculo?: { marca?: string; modelo?: string; ano?: number; versao?: string | null }
    segmento_codigo?: string
    tamanho_codigo?: string
    tipo_pintura_codigo?: string | null
    quem_paga?: string
  }

  const hasFullData = "custo_mo" in snap

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Snapshot de Custo</h1>
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <Badge variant="outline" className="text-xs border-border text-foreground/60 ml-auto">
          {snap.origem}
        </Badge>
      </div>

      {/* Veículo / contexto */}
      <section className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contexto</p>
        <div className="rounded-lg border border-border px-4 py-1">
          <InfoRow label="ID" value={snap.id} />
          {ctx.veiculo && (
            <InfoRow
              label="Veículo"
              value={`${ctx.veiculo.marca} ${ctx.veiculo.modelo} ${ctx.veiculo.ano}${ctx.veiculo.versao ? ` — ${ctx.veiculo.versao}` : ""}`}
            />
          )}
          {ctx.segmento_codigo && <InfoRow label="Segmento" value={ctx.segmento_codigo} />}
          {ctx.tamanho_codigo && <InfoRow label="Tamanho" value={ctx.tamanho_codigo} />}
          {ctx.tipo_pintura_codigo && (
            <InfoRow label="Tipo pintura" value={ctx.tipo_pintura_codigo} />
          )}
          {ctx.quem_paga && <InfoRow label="Quem paga" value={ctx.quem_paga} />}
          <InfoRow
            label="Calculado em"
            value={new Date(snap.calculado_em).toLocaleString("pt-BR")}
          />
        </div>
      </section>

      {/* Preços */}
      <section className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preço</p>
        <div className="rounded-lg border border-border px-4 py-1">
          {"preco_calculado" in snap && (
            <InfoRow label="Preço calculado" value={formatCurrency((snap as { preco_calculado?: string }).preco_calculado)} />
          )}
          {"preco_teto_benchmark" in snap && (snap as { preco_teto_benchmark?: string | null }).preco_teto_benchmark && (
            <InfoRow
              label="Teto benchmark"
              value={formatCurrency((snap as { preco_teto_benchmark?: string | null }).preco_teto_benchmark ?? undefined)}
            />
          )}
          <InfoRow label="Preço final" value={formatCurrency(snap.preco_final)} />
        </div>
      </section>

      {/* Margens */}
      {"margem_base" in snap && (
        <section className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Margens</p>
          <div className="rounded-lg border border-border px-4 py-1">
            <InfoRow label="Margem base" value={formatMargem((snap as { margem_base?: string }).margem_base)} />
            <InfoRow
              label="Fator responsabilidade"
              value={formatMargem((snap as { fator_responsabilidade?: string }).fator_responsabilidade)}
            />
            <InfoRow label="Margem ajustada" value={formatMargem((snap as { margem_ajustada?: string }).margem_ajustada)} />
          </div>
        </section>
      )}

      {/* Custos detalhados (ADMIN+) */}
      {hasFullData && (
        <section className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Custos (ADMIN)
          </p>
          <div className="rounded-lg border border-border px-4 py-1">
            <InfoRow label="Mão de obra" value={formatCurrency((snap as { custo_mo?: string }).custo_mo)} />
            <InfoRow label="Insumos" value={formatCurrency((snap as { custo_insumos?: string }).custo_insumos)} />
            <InfoRow label="Rateio" value={formatCurrency((snap as { rateio?: string }).rateio)} />
            <InfoRow label="Peça base" value={formatCurrency((snap as { custo_peca_base?: string }).custo_peca_base)} />
            <InfoRow label="Total base" value={formatCurrency((snap as { custo_total_base?: string }).custo_total_base)} />
          </div>
        </section>
      )}

      {/* Decomposição */}
      {"decomposicao" in snap && (
        <section className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Decomposição (JSON)
          </p>
          <pre className="rounded-lg border border-border bg-muted/50 p-4 text-xs text-foreground/60 overflow-auto max-h-64">
            {JSON.stringify((snap as { decomposicao?: unknown }).decomposicao, null, 2)}
          </pre>
        </section>
      )}
    </div>
  )
}
