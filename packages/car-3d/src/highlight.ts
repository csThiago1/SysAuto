import type { PanelKey } from "./panels";
import type { Regions } from "./regions";

/** Limite de caixas acesas no shader (uniforms de tamanho fixo). */
export const MAX_HIGHLIGHT_BOXES = 24;

// Aviso de corte só uma vez por sessão: o chamador pode rodar isto a cada render.
let warnedCut = false;

export type HighlightUniforms = {
  centers: Float32Array;
  sizes: Float32Array;
  rotY: Float32Array;
  colors: Float32Array;
  count: number;
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function buildHighlightUniforms(
  highlights: { panel: PanelKey; color: string }[],
  regions: Regions,
): HighlightUniforms {
  const u: HighlightUniforms = {
    centers: new Float32Array(MAX_HIGHLIGHT_BOXES * 3),
    sizes: new Float32Array(MAX_HIGHLIGHT_BOXES * 3),
    rotY: new Float32Array(MAX_HIGHLIGHT_BOXES),
    colors: new Float32Array(MAX_HIGHLIGHT_BOXES * 3),
    count: 0,
  };
  const boxes = highlights.flatMap(({ panel, color }) =>
    (regions.panels[panel] ?? []).map((box) => ({ box, rgb: hexToRgb(color) })),
  );
  if (boxes.length > MAX_HIGHLIGHT_BOXES && !warnedCut) {
    warnedCut = true;
    console.warn(`car-3d: ${boxes.length} caixas acesas, cortando em ${MAX_HIGHLIGHT_BOXES}`);
  }
  for (const { box, rgb } of boxes.slice(0, MAX_HIGHLIGHT_BOXES)) {
    const i = u.count++;
    u.centers.set(box.center, i * 3);
    u.sizes.set(box.size, i * 3);
    u.rotY[i] = box.rotationY ?? 0;
    u.colors.set(rgb, i * 3);
  }
  return u;
}
