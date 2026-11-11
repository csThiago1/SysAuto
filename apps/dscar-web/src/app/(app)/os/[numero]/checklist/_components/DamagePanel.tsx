"use client"

import { useState, type ReactElement } from "react"
import { ArrowLeft, Camera, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  DAMAGE_TYPES,
  PANEL_KEYS,
  PANEL_LABELS,
  RELATIONS,
  SEVERITIES,
  SEVERITY_COLORS,
  type PanelKey,
  type Vec3,
} from "@paddock/car-3d"

import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { useChecklistPhotos, useUploadChecklistPhoto } from "../_hooks/useChecklistPhotos"
import {
  useCreateDamage,
  useDeactivateDamage,
  usePatchDamage,
  type DamageInput,
} from "../_hooks/useEntryChecklist"
import { toastChecklistError } from "../_lib/checklistErrors"
import type { ChecklistDamage } from "../_schemas/checklist.schema"

type Props = {
  osId: string
  /** Peça tocada no carro (novo dano). Ignorado quando `damage` vem. */
  panelKey: PanelKey | null
  point: Vec3 | null
  /** Dano existente: o painel abre em modo edição. */
  damage?: ChecklistDamage
  locked: boolean
  onClose: () => void
}

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  colorOf,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
  disabled: boolean
  colorOf?: (v: T) => string
}): ReactElement {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.value === value
          const color = colorOf?.(o.value)
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={cn(
                "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-sm transition-colors disabled:opacity-50",
                active
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function DamagePanel({ osId, panelKey, point, damage, locked, onClose }: Props): ReactElement {
  const [panel, setPanel] = useState<PanelKey | null>(damage?.panel_key ?? panelKey)
  const [type, setType] = useState<ChecklistDamage["damage_type"] | null>(damage?.damage_type ?? null)
  const [severity, setSeverity] = useState<ChecklistDamage["severity"] | null>(damage?.severity ?? null)
  const [relation, setRelation] = useState<ChecklistDamage["relation"]>(damage?.relation ?? "nao_sei")
  const [notes, setNotes] = useState(damage?.notes ?? "")
  // null = fotos intocadas: o PATCH não reenvia `photo_ids` (uma foto apagada depois, que o
  // M2M ainda lista, faria o backend recusar a edição com {"photos": "pending"})
  const [pickedIds, setPickedIds] = useState<string[] | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const photos = useChecklistPhotos(osId)
  const upload = useUploadChecklistPhoto(osId)
  const create = useCreateDamage(osId)
  const patch = usePatchDamage(osId)
  const deactivate = useDeactivateDamage(osId)
  const busy = create.isPending || patch.isPending || deactivate.isPending

  // só conta e mostra as fotos ativas do checklist (soft delete some da grade)
  const activeIds = new Set((photos.data ?? []).map((p) => p.id))
  const photoIds = pickedIds ?? (damage?.photo_ids ?? []).filter((id) => activeIds.has(id))

  const togglePhoto = (id: string): void =>
    setPickedIds((ids) => {
      const cur = ids ?? photoIds
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    })

  async function handleFiles(files: FileList | null): Promise<void> {
    for (const file of Array.from(files ?? [])) {
      try {
        const photo = await upload.mutateAsync(file)
        setPickedIds((ids) => [...(ids ?? photoIds), photo.id])
      } catch {
        toast.error("Não deu para enviar a foto. Tente de novo.")
      }
    }
  }

  async function save(): Promise<void> {
    if (!panel || !type || !severity) return
    try {
      if (damage) {
        await patch.mutateAsync({
          id: damage.id,
          damage_type: type,
          severity,
          relation,
          notes: notes.trim(),
          ...(pickedIds && { photo_ids: pickedIds }),
        })
      } else {
        const input: DamageInput = { panel_key: panel, damage_type: type, severity, relation }
        // o ponto só vale para a peça tocada; trocar a peça na lista descarta o marcador
        if (point && panel === panelKey) input.point = { x: point[0], y: point[1], z: point[2] }
        if (notes.trim()) input.notes = notes.trim()
        if (photoIds.length) input.photo_ids = photoIds
        await create.mutateAsync(input)
      }
      onClose()
    } catch (err) {
      toastChecklistError(err, "Não deu para salvar o dano. Tente de novo.")
    }
  }

  async function handleDeactivate(): Promise<void> {
    if (!damage) return
    try {
      await deactivate.mutateAsync(damage.id)
      onClose()
    } catch (err) {
      toastChecklistError(err, "Não deu para desativar o dano. Tente de novo.")
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold">
          {damage ? `Dano ${damage.number}` : "Novo dano"}
          {panel && <span className="ml-1.5 font-normal text-muted-foreground">· {PANEL_LABELS[panel]}</span>}
        </h2>
      </div>

      {!damage && (
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Peça</span>
          <NativeSelect
            value={panel ?? ""}
            disabled={locked}
            onChange={(e) => setPanel(PANEL_KEYS.find((k) => k === e.target.value) ?? null)}
          >
            <option value="" disabled>
              Escolha a peça…
            </option>
            {PANEL_KEYS.map((key) => (
              <option key={key} value={key}>
                {PANEL_LABELS[key]}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}

      <Chips label="Tipo" options={DAMAGE_TYPES} value={type} onChange={setType} disabled={locked} />
      <Chips
        label="Gravidade"
        options={SEVERITIES}
        value={severity}
        onChange={setSeverity}
        disabled={locked}
        colorOf={(s) => SEVERITY_COLORS[s]}
      />
      <Chips label="Relação" options={RELATIONS} value={relation} onChange={setRelation} disabled={locked} />

      <section className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Fotos ({photoIds.length})
        </p>
        {photos.isLoading ? (
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-md" />
            ))}
          </div>
        ) : photos.isError ? (
          <p className="text-xs text-error-400">Não deu para carregar as fotos do checklist.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {(photos.data ?? []).map((p) => {
              const selected = photoIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={selected ? "Tirar foto do dano" : "Usar foto no dano"}
                  disabled={locked}
                  onClick={() => togglePhoto(p.id)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-md border-2 bg-muted",
                    selected ? "border-primary" : "border-transparent",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.url && <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  {selected && (
                    <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </span>
                  )}
                </button>
              )
            })}
            {!locked && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-[11px] text-muted-foreground hover:text-foreground">
                {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Nova foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="sr-only"
                  disabled={upload.isPending}
                  onChange={(e) => {
                    void handleFiles(e.target.files)
                    e.target.value = ""
                  }}
                />
              </label>
            )}
          </div>
        )}
      </section>

      <label className="space-y-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notas</span>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={locked} rows={2} />
      </label>

      {!locked && (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Button onClick={() => void save()} disabled={busy || !panel || !type || !severity}>
            Salvar dano
          </Button>
          {damage &&
            (confirmDeactivate ? (
              <Button variant="destructive" onClick={() => void handleDeactivate()} disabled={busy}>
                Confirmar: desativar dano {damage.number}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDeactivate(true)} disabled={busy}>
                Desativar dano
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}
