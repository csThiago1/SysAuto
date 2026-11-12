import { canCompleteStop, SEVERITY_COLORS, type PanelKey, type Severity, type Stop, type StopKey } from '@paddock/car-3d/core';
import type { PhotoQueueItem } from '@/stores/photo.store';
import type { EntryChecklistDraft, QueuedDamage } from '@/stores/entry-checklist.store';

export const FOLDER = 'checklist_entrada';
export const CHECKLIST_TYPE = 'entrada';

/** Slot das fotos de dano tiradas na parada (não preenche slot obrigatório). */
export const damageSlot = (stop: StopKey): string => `dano_${stop}`;

/** Fotos desta OS no checklist de entrada que pertencem à parada (slots dela + fotos de dano dela). */
export function stopPhotos(queue: PhotoQueueItem[], osId: string, stop: Stop): PhotoQueueItem[] {
  const slots = new Set([...stop.slots, damageSlot(stop.key)]);
  return queue.filter((p) => p.osId === osId && p.folder === FOLDER && slots.has(p.slot));
}

export function checkStop(
  stop: Stop,
  draft: EntryChecklistDraft,
  photos: PhotoQueueItem[],
  noDamageTapped: boolean,
): { ok: boolean; missing: string[] } {
  const panels = new Set<PanelKey>(stop.panels);
  return canCompleteStop(stop.key, {
    photoSlots: new Set(photos.map((p) => p.slot)),
    damageCount: draft.damages.filter((d) => panels.has(d.panelKey)).length,
    noDamage: noDamageTapped || draft.stops[stop.key] === 'sem_dano',
  });
}

const RANK: Record<Severity, number> = { leve: 0, moderada: 1, grave: 2 };

/** Peça acesa na cor da pior gravidade entre os danos dela. */
export function highlightsFor(damages: QueuedDamage[]): { panel: PanelKey; color: string }[] {
  const worst = new Map<PanelKey, Severity>();
  for (const d of damages) {
    const cur = worst.get(d.panelKey);
    if (!cur || RANK[d.severity] > RANK[cur]) worst.set(d.panelKey, d.severity);
  }
  return [...worst].map(([panel, sev]) => ({ panel, color: SEVERITY_COLORS[sev] }));
}
