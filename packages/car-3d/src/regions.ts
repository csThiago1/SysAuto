import { z } from "zod";
import { PANEL_KEYS, type PanelKey } from "./panels";

export type Vec3 = [number, number, number];
export type RegionBox = { center: Vec3; size: Vec3; rotationY?: number };
export type Regions = {
  model: string;
  paintMaterials: string[];
  panels: Partial<Record<PanelKey, RegionBox[]>>;
};

const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

const RegionBoxSchema = z.object({
  center: Vec3Schema,
  size: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
  rotationY: z.number().optional(),
});

export const RegionsSchema: z.ZodType<Regions> = z.object({
  model: z.string(),
  paintMaterials: z.array(z.string()),
  panels: z.record(z.enum(PANEL_KEYS), z.array(RegionBoxSchema)),
});

function contains(box: RegionBox, [px, py, pz]: Vec3): boolean {
  const [cx, cy, cz] = box.center;
  const [sx, sy, sz] = box.size;
  // gira o ponto por -rotationY em torno do centro, para testar na caixa alinhada
  const r = box.rotationY ?? 0;
  const dx = px - cx;
  const dz = pz - cz;
  const lx = dx * Math.cos(r) - dz * Math.sin(r);
  const lz = dx * Math.sin(r) + dz * Math.cos(r);
  return Math.abs(lx) <= sx / 2 && Math.abs(py - cy) <= sy / 2 && Math.abs(lz) <= sz / 2;
}

/** Peça do ponto tocado (espaço do modelo). Caixas sobrepostas: vence a de menor volume. */
export function panelAt(point: Vec3, regions: Regions): PanelKey | null {
  let best: PanelKey | null = null;
  let bestVolume = Infinity;
  for (const key of PANEL_KEYS) {
    for (const box of regions.panels[key] ?? []) {
      const volume = box.size[0] * box.size[1] * box.size[2];
      if (volume < bestVolume && contains(box, point)) {
        best = key;
        bestVolume = volume;
      }
    }
  }
  return best;
}
