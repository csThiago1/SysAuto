"use client"

import { useMemo, useRef, useState, type ReactElement } from "react"
import { useGLTF, useProgress } from "@react-three/drei"
import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { ErrorBoundary } from "react-error-boundary"
import { FileText, GitCompareArrows, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  creditLine,
  RegionsSchema,
  resolveCarModel,
  SEVERITY_COLORS,
  STOPS,
  type BodyType,
  type Car3DHandle,
  type CameraView,
  type PanelKey,
  type Vec3,
} from "@paddock/car-3d"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import {
  useBelongings,
  useBudgetMatch,
  useChecklistDamages,
  useChecklistHistory,
  useEntryChecklist,
  usePatchChecklist,
} from "../_hooks/useEntryChecklist"
import { toastChecklistError } from "../_lib/checklistErrors"
import type { ChecklistDamage, EntryChecklistState } from "../_schemas/checklist.schema"
import { BelongingsTab } from "./BelongingsTab"
import { UnmappedBudgetItems } from "./BudgetDivergence"
import { DamageList } from "./DamageList"
import { DamagePanel } from "./DamagePanel"
import { FinalizeBar } from "./FinalizeBar"
import { ItemsTab } from "./ItemsTab"

// WebGL só no navegador
const Car3D = dynamic(() => import("@paddock/car-3d").then((m) => m.Car3D), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
})

const VIEWS: { view: CameraView; label: string }[] = [
  { view: "front34", label: "3D" },
  { view: "front", label: "Frente" },
  { view: "left", label: "Lado E" },
  { view: "rear", label: "Trás" },
  { view: "right", label: "Lado D" },
  { view: "top", label: "Teto" },
]

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: "hatch", label: "Hatch" },
  { value: "sedan", label: "Sedã" },
  { value: "suv", label: "SUV" },
  { value: "pickup", label: "Picape" },
  { value: "van", label: "Van" },
]

/** Ângulos do PDF (SNAPSHOT_KEYS do backend). */
const SNAPSHOT_VIEWS = ["front34", "rear34", "left", "right"] as const

const SEVERITY_RANK: Record<ChecklistDamage["severity"], number> = { leve: 0, moderada: 1, grave: 2 }

type Editing = { panelKey: PanelKey | null; point: Vec3 | null } | { damage: ChecklistDamage } | null

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })

function BodyTypePicker({ osId, state }: { osId: string; state: EntryChecklistState }): ReactElement {
  const [choice, setChoice] = useState<BodyType | null>(state.suggested_body_type)
  const patch = usePatchChecklist(osId)
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 text-center">
      <div>
        <h2 className="text-lg font-semibold">Qual a carroceria?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Define o carro 3D da conferência e fica como sugestão para esta família.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {BODY_TYPES.map((b) => (
          <button
            key={b.value}
            type="button"
            aria-pressed={choice === b.value}
            onClick={() => setChoice(b.value)}
            className={cn(
              "min-h-[56px] rounded-lg border text-sm font-medium transition-colors",
              choice === b.value ? "border-primary bg-primary/15" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
      <Button
        disabled={!choice || patch.isPending}
        onClick={() => choice && patch.mutate({ body_type: choice }, { onError: (e) => toastChecklistError(e, "Não deu para salvar a carroceria.") })}
      >
        Continuar
      </Button>
    </div>
  )
}

function VehicleHistory({ osId }: { osId: string }): ReactElement | null {
  const history = useChecklistHistory(osId)
  const list = history.data ?? []
  if (list.length === 0) return null
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checklists anteriores deste veículo</h3>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {list.map((h) => (
          <li key={h.os_number} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="tabular-nums text-muted-foreground">{h.finalized_at ? dateFmt.format(new Date(h.finalized_at)) : "—"}</span>
            <span className="font-medium">OS {h.os_number}</span>
            <span className="text-muted-foreground">
              {h.damage_count} {h.damage_count === 1 ? "dano" : "danos"}
            </span>
            {h.pdf_url && (
              <a href={h.pdf_url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
                <FileText className="h-3.5 w-3.5" />
                PDF
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CanvasError({ onRetry }: { onRetry: () => void }): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">Não deu para carregar o carro 3D.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  )
}

export function ChecklistViewer({ osId, customerName }: { osId: string; customerName: string }): ReactElement {
  const checklist = useEntryChecklist(osId)
  const damagesQuery = useChecklistDamages(osId)
  const belongings = useBelongings(osId)
  const match = useBudgetMatch(osId)
  const carRef = useRef<Car3DHandle>(null)
  const [view, setView] = useState<CameraView>("front34")
  const [tab, setTab] = useState("danos")
  const [editing, setEditing] = useState<Editing>(null)

  const state = checklist.data
  const damages = useMemo(() => damagesQuery.data ?? [], [damagesQuery.data])
  const locked = state?.finalized_at != null
  const bodyType = state?.body_type ?? null

  const model = useMemo(
    () =>
      state && bodyType
        ? resolveCarModel({
            make: state.vehicle_make,
            family: state.vehicle_family,
            bodyType,
            allowNc: state.allow_nc_models,
          })
        : null,
    [state, bodyType],
  )
  const modelUrl = model ? `/car-3d/${model.file}` : ""
  const regions = useQuery({
    queryKey: ["car-3d-regions", model?.regionsFile],
    queryFn: async () => {
      const res = await fetch(`/car-3d/regions/${model?.regionsFile}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return RegionsSchema.parse(await res.json())
    },
    enabled: !!model,
    staleTime: Infinity,
  })
  const { active: glbLoading } = useProgress()

  const highlights = useMemo(() => {
    const worst = new Map<PanelKey, ChecklistDamage["severity"]>()
    for (const d of damages) {
      const cur = worst.get(d.panel_key)
      if (!cur || SEVERITY_RANK[d.severity] > SEVERITY_RANK[cur]) worst.set(d.panel_key, d.severity)
    }
    return [...worst].map(([panel, sev]) => ({ panel, color: SEVERITY_COLORS[sev] }))
  }, [damages])
  const pins = useMemo(
    () =>
      damages.flatMap((d) =>
        d.point ? [{ number: d.number, point: [d.point.x, d.point.y, d.point.z] as Vec3, color: SEVERITY_COLORS[d.severity] }] : [],
      ),
    [damages],
  )

  if (checklist.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-[52vh] rounded-xl lg:h-[calc(100vh-200px)]" />
        <Skeleton className="h-[40vh] rounded-xl" />
      </div>
    )
  }
  if (checklist.isError || !state) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">Não deu para carregar o checklist.</p>
        <Button variant="outline" onClick={() => void checklist.refetch()}>
          Tentar de novo
        </Button>
      </div>
    )
  }
  if (!bodyType || !model) return <BodyTypePicker osId={osId} state={state} />

  const onPanelTap = (panel: PanelKey | null, point: Vec3): void => {
    if (locked) {
      const existing = damages.find((d) => d.panel_key === panel)
      if (existing) setEditing({ damage: existing })
      return
    }
    setEditing({ panelKey: panel, point })
  }

  const onMissing = (item: string): void => {
    const [kind, key] = item.split(":")
    if (kind === "stop") {
      const stop = STOPS.find((s) => s.key === key)
      if (stop && stop.view !== "free") setView(stop.view)
      setEditing(null)
      setTab("danos")
    } else if (kind === "damage") {
      const damage = damages.find((d) => String(d.number) === key)
      if (damage) setEditing({ damage })
    }
  }

  const takeSnapshots = async (): Promise<Record<string, string>> => {
    const car = carRef.current
    if (!car) throw new Error("car-3d: modelo ainda não carregou")
    const shots: Record<string, string> = {}
    // em série: as quatro vistas usam o mesmo renderer
    for (const v of SNAPSHOT_VIEWS) shots[v] = await car.snapshot(v)
    return shots
  }

  const hasBudget =
    damages.some((d) => d.budget_match !== "sem_orcamento") ||
    (match.data ? match.data.inside > 0 || match.data.outside.length > 0 || match.data.unmapped.length > 0 : false)
  const belongingCount = belongings.data?.length ?? 0

  // ponytail: o cruzamento grava budget_match nos danos, então é ação explícita e só com o
  // checklist aberto; GET de leitura do resumo se a lista de não mapeados precisar abrir sozinha
  const runMatch = (): void =>
    match.mutate(undefined, {
      onSuccess: (s) =>
        toast.success(`Cruzamento feito: ${s.inside} no orçamento, ${s.outside.length} fora, ${s.unmapped.length} sem peça.`),
      onError: (e) => toastChecklistError(e, "Não deu para cruzar com o orçamento. Tente de novo."),
    })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <div className="relative h-[52vh] overflow-hidden rounded-xl border border-border bg-[radial-gradient(ellipse_at_50%_40%,hsl(var(--muted))_0%,hsl(var(--background))_72%)] lg:h-[calc(100vh-200px)]">
          {regions.isError ? (
            <CanvasError onRetry={() => void regions.refetch()} />
          ) : regions.data ? (
            <ErrorBoundary
              resetKeys={[modelUrl]}
              onReset={() => useGLTF.clear(modelUrl)}
              fallbackRender={({ resetErrorBoundary }) => <CanvasError onRetry={resetErrorBoundary} />}
            >
              <Car3D
                ref={carRef}
                className="h-full w-full"
                modelUrl={modelUrl}
                regions={regions.data}
                color={state.vehicle_color_hex}
                highlights={highlights}
                pins={pins}
                view={view}
                onPanelTap={onPanelTap}
              />
            </ErrorBoundary>
          ) : null}
          {(regions.isLoading || glbLoading) && <Skeleton className="absolute inset-0 rounded-none" />}

          <div className="absolute left-3 top-3 flex flex-wrap gap-1 rounded-full border border-border bg-background/70 p-1 backdrop-blur" role="group" aria-label="Vista do carro">
            {VIEWS.map((v) => (
              <button
                key={v.view}
                type="button"
                aria-pressed={view === v.view}
                onClick={() => setView(v.view)}
                className={cn(
                  "min-h-[32px] rounded-full px-3 text-xs font-medium transition-colors",
                  view === v.view ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          {!locked && (
            <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              Toque numa peça para marcar um dano
            </p>
          )}
        </div>
        <VehicleHistory osId={osId} />
      </div>

      <aside className="flex min-w-0 flex-col gap-3">
        <FinalizeBar
          osId={osId}
          state={state}
          damages={damages}
          customerName={customerName}
          hasBudget={hasBudget}
          modelCredit={creditLine(model)}
          takeSnapshots={takeSnapshots}
          onMissing={onMissing}
        />
        <div className="min-h-[320px] flex-1 overflow-hidden rounded-xl border border-border bg-card/60">
          {editing ? (
            <DamagePanel
              // remonta ao trocar de dano/peça: o formulário começa do zero
              key={"damage" in editing ? editing.damage.id : `new-${editing.panelKey}-${editing.point?.join(",")}`}
              osId={osId}
              panelKey={"damage" in editing ? null : editing.panelKey}
              point={"damage" in editing ? null : editing.point}
              damage={"damage" in editing ? editing.damage : undefined}
              locked={locked}
              onClose={() => setEditing(null)}
            />
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
              <TabsList className="m-2 grid grid-cols-3 bg-muted/50">
                <TabsTrigger value="danos">Danos ({damages.length})</TabsTrigger>
                <TabsTrigger value="itens">Itens do veículo</TabsTrigger>
                <TabsTrigger value="pertences">Pertences ({belongingCount})</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                <TabsContent value="danos" className="space-y-3">
                  {state.customer_type === "insurer" && !locked && (
                    <Button variant="outline" size="sm" className="w-full" disabled={match.isPending} onClick={runMatch}>
                      {match.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Cruzar com o orçamento
                    </Button>
                  )}
                  {match.data && <UnmappedBudgetItems osId={osId} items={match.data.unmapped} />}
                  {damagesQuery.isLoading ? (
                    <div className="space-y-1.5">
                      {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-14 rounded-[11px]" />
                      ))}
                    </div>
                  ) : damagesQuery.isError ? (
                    <div className="space-y-2 py-6 text-center">
                      <p className="text-sm text-muted-foreground">Não deu para carregar os danos.</p>
                      <Button variant="outline" size="sm" onClick={() => void damagesQuery.refetch()}>
                        Tentar de novo
                      </Button>
                    </div>
                  ) : (
                    <DamageList damages={damages} onSelect={(damage) => setEditing({ damage })} />
                  )}
                  {!locked && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing({ panelKey: null, point: null })}>
                      Marcar dano pela lista de peças
                    </Button>
                  )}
                </TabsContent>
                <TabsContent value="itens">
                  <ItemsTab osId={osId} summary={state.items_summary} locked={locked} />
                </TabsContent>
                <TabsContent value="pertences">
                  <BelongingsTab osId={osId} />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </aside>
    </div>
  )
}
