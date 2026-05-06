"use client"

import { use, useState } from "react"
import { Warehouse, Plus } from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { toast } from "sonner"
import type { ArmazemTipo } from "@paddock/types"
import {
  useArmazem,
  useRuaCreate,
  usePrateleiras,
  usePrateleiraCreate,
  useNivelCreate,
  useRuas,
} from "@/hooks/useInventoryLocation"
import { ArmazemTree } from "@/components/inventory/ArmazemTree"

const TIPO_BADGE: Record<ArmazemTipo, { label: string; className: string }> = {
  galpao: {
    label: "GALPÃO",
    className: "bg-info-500/10 text-info-400 border border-info-500/20",
  },
  patio: {
    label: "PÁTIO",
    className: "bg-warning-500/10 text-warning-400 border border-warning-500/20",
  },
}

type InlineForm = "rua" | "prateleira" | "nivel" | null

export default function ArmazemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: armazem, isLoading } = useArmazem(id)
  const { data: ruas = [] } = useRuas(id)

  const ruaCreate = useRuaCreate()
  const prateleiraCreate = usePrateleiraCreate()
  const nivelCreate = useNivelCreate()

  const [activeForm, setActiveForm] = useState<InlineForm>(null)

  // Rua form
  const [ruaCodigo, setRuaCodigo] = useState("")
  const [ruaDescricao, setRuaDescricao] = useState("")

  // Prateleira form
  const [pratRuaId, setPratRuaId] = useState("")
  const [pratCodigo, setPratCodigo] = useState("")
  const [pratCapacidade, setPratCapacidade] = useState("")

  // Nivel form — select a rua first, then prateleira
  const [nivelRuaId, setNivelRuaId] = useState("")
  const [nivelPratId, setNivelPratId] = useState("")
  const [nivelCodigo, setNivelCodigo] = useState("")

  // Fetch prateleiras for the nivel form's selected rua
  const { data: nivelPrateleiras = [] } = usePrateleiras(
    nivelRuaId || undefined
  )

  function resetForms() {
    setRuaCodigo("")
    setRuaDescricao("")
    setPratRuaId("")
    setPratCodigo("")
    setPratCapacidade("")
    setNivelRuaId("")
    setNivelPratId("")
    setNivelCodigo("")
  }

  async function handleCreateRua() {
    if (!ruaCodigo.trim()) {
      toast.error("Preencha o código da rua.")
      return
    }
    try {
      await ruaCreate.mutateAsync({
        armazem: id,
        codigo: ruaCodigo.trim(),
        descricao: ruaDescricao.trim(),
      })
      toast.success("Rua criada.")
      resetForms()
      setActiveForm(null)
    } catch {
      toast.error("Erro ao criar rua.")
    }
  }

  async function handleCreatePrateleira() {
    if (!pratRuaId || !pratCodigo.trim()) {
      toast.error("Selecione a rua e preencha o código.")
      return
    }
    try {
      await prateleiraCreate.mutateAsync({
        rua: pratRuaId,
        codigo: pratCodigo.trim(),
        capacidade_kg: pratCapacidade.trim() || null,
      })
      toast.success("Prateleira criada.")
      resetForms()
      setActiveForm(null)
    } catch {
      toast.error("Erro ao criar prateleira.")
    }
  }

  async function handleCreateNivel() {
    if (!nivelPratId || !nivelCodigo.trim()) {
      toast.error("Selecione a prateleira e preencha o código.")
      return
    }
    try {
      await nivelCreate.mutateAsync({
        prateleira: nivelPratId,
        codigo: nivelCodigo.trim(),
      })
      toast.success("Nível criado.")
      resetForms()
      setActiveForm(null)
    } catch {
      toast.error("Erro ao criar nível.")
    }
  }

  if (isLoading || !armazem) {
    return (
      <div className="p-6 text-muted-foreground text-sm">Carregando armazém...</div>
    )
  }

  const badge = TIPO_BADGE[armazem.tipo] ?? TIPO_BADGE.galpao

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Estoque", href: "/estoque" },
          { label: "Armazéns", href: "/estoque/armazens" },
          { label: armazem.nome },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Warehouse className="h-5 w-5 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">
                {armazem.nome}
              </h1>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="label-mono">{armazem.codigo}</span>
              <span className="text-xs text-muted-foreground">
                {armazem.total_ruas} rua{armazem.total_ruas !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(["rua", "prateleira", "nivel"] as const).map((form) => (
            <button
              key={form}
              type="button"
              onClick={() =>
                setActiveForm((prev) => {
                  resetForms()
                  return prev === form ? null : form
                })
              }
              className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeForm === form
                  ? "border-primary text-primary/80 bg-primary/10"
                  : "border-border text-foreground/60 hover:text-foreground hover:border-border"
              }`}
            >
              <Plus className="h-3 w-3" />
              {form === "rua"
                ? "Rua"
                : form === "prateleira"
                  ? "Prateleira"
                  : "Nível"}
            </button>
          ))}
        </div>
      </div>

      {/* Inline forms */}
      {activeForm === "rua" && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
          <div className="section-divider">NOVA RUA</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                CÓDIGO
              </label>
              <input
                value={ruaCodigo}
                onChange={(e) => setRuaCodigo(e.target.value)}
                placeholder="R01"
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                DESCRIÇÃO
              </label>
              <input
                value={ruaDescricao}
                onChange={(e) => setRuaDescricao(e.target.value)}
                placeholder="Rua de Funilaria"
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForms()
                setActiveForm(null)
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateRua}
              disabled={ruaCreate.isPending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {ruaCreate.isPending ? "Criando..." : "Criar Rua"}
            </button>
          </div>
        </div>
      )}

      {activeForm === "prateleira" && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
          <div className="section-divider">NOVA PRATELEIRA</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                RUA
              </label>
              <select
                value={pratRuaId}
                onChange={(e) => setPratRuaId(e.target.value)}
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecione...</option>
                {ruas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.codigo}
                    {r.descricao ? ` — ${r.descricao}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                CÓDIGO
              </label>
              <input
                value={pratCodigo}
                onChange={(e) => setPratCodigo(e.target.value)}
                placeholder="P01"
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                CAPACIDADE (KG)
              </label>
              <input
                value={pratCapacidade}
                onChange={(e) => setPratCapacidade(e.target.value)}
                placeholder="200"
                type="number"
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForms()
                setActiveForm(null)
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreatePrateleira}
              disabled={prateleiraCreate.isPending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {prateleiraCreate.isPending ? "Criando..." : "Criar Prateleira"}
            </button>
          </div>
        </div>
      )}

      {activeForm === "nivel" && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
          <div className="section-divider">NOVO NÍVEL</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                RUA
              </label>
              <select
                value={nivelRuaId}
                onChange={(e) => {
                  setNivelRuaId(e.target.value)
                  setNivelPratId("")
                }}
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Selecione a rua...</option>
                {ruas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.codigo}
                    {r.descricao ? ` — ${r.descricao}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                PRATELEIRA
              </label>
              <select
                value={nivelPratId}
                onChange={(e) => setNivelPratId(e.target.value)}
                disabled={!nivelRuaId}
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
              >
                <option value="">
                  {nivelRuaId ? "Selecione..." : "Escolha a rua primeiro"}
                </option>
                {nivelPrateleiras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo}
                    {p.descricao ? ` — ${p.descricao}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-0.5 block">
                CÓDIGO
              </label>
              <input
                value={nivelCodigo}
                onChange={(e) => setNivelCodigo(e.target.value)}
                placeholder="N1"
                className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForms()
                setActiveForm(null)
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateNivel}
              disabled={nivelCreate.isPending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {nivelCreate.isPending ? "Criando..." : "Criar Nível"}
            </button>
          </div>
        </div>
      )}

      {/* Tree section */}
      <div className="section-divider">HIERARQUIA</div>
      <ArmazemTree armazemId={id} />
    </div>
  )
}
