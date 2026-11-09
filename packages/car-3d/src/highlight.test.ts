import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHighlightUniforms, MAX_HIGHLIGHT_BOXES } from "./highlight";
import type { Regions, RegionBox } from "./regions";

const box = (x: number): RegionBox => ({ center: [x, 0, 0], size: [1, 2, 3], rotationY: 0.5 });

afterEach(() => vi.restoreAllMocks());

describe("buildHighlightUniforms", () => {
  it("empacota caixas e cor em floats", () => {
    const regions: Regions = {
      model: "t",
      paintMaterials: [],
      panels: { capo: [box(1)], teto: [box(2), box(3)] },
    };
    const u = buildHighlightUniforms(
      [
        { panel: "capo", color: "#ff0000" },
        { panel: "teto", color: "#00ff00" },
        { panel: "grade", color: "#0000ff" }, // sem volume no modelo: ignorada
      ],
      regions,
    );
    expect(u.count).toBe(3);
    expect(Array.from(u.centers.slice(0, 9))).toEqual([1, 0, 0, 2, 0, 0, 3, 0, 0]);
    expect(Array.from(u.sizes.slice(0, 3))).toEqual([1, 2, 3]);
    expect(u.rotY[0]).toBeCloseTo(0.5);
    expect(Array.from(u.colors.slice(0, 6))).toEqual([1, 0, 0, 0, 1, 0]);
    expect(u.centers.length).toBe(MAX_HIGHLIGHT_BOXES * 3);
  });

  it("corta em 24 caixas e avisa uma vez", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const regions: Regions = {
      model: "t",
      paintMaterials: [],
      panels: { capo: Array.from({ length: 30 }, (_, i) => box(i)) },
    };
    const u = buildHighlightUniforms([{ panel: "capo", color: "#ea0e03" }], regions);
    expect(u.count).toBe(24);
    // chamado a cada render: o aviso não pode repetir
    buildHighlightUniforms([{ panel: "capo", color: "#ea0e03" }], regions);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
