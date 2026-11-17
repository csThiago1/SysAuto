import { describe, expect, it } from "vitest";
import { panelAt, RegionsSchema, type Regions } from "./regions";

const regions: Regions = {
  model: "teste",
  paintMaterials: ["Body"],
  panels: {
    porta_diant_e: [{ center: [0, 0, 0], size: [2, 2, 2] }],
    retrovisor_e: [{ center: [0.5, 0.5, 0.5], size: [0.4, 0.4, 0.4] }],
    capo: [{ center: [10, 0, 0], size: [4, 1, 1], rotationY: Math.PI / 2 }],
  },
};

describe("panelAt", () => {
  it("acha a peça cuja caixa contém o ponto", () => {
    expect(panelAt([-0.5, 0, 0], regions)).toBe("porta_diant_e");
  });

  it("null fora de todas as caixas", () => {
    expect(panelAt([5, 5, 5], regions)).toBeNull();
  });

  it("caixas sobrepostas: vale a de menor volume", () => {
    expect(panelAt([0.5, 0.5, 0.5], regions)).toBe("retrovisor_e");
  });

  it("respeita rotationY", () => {
    // caixa 4x1x1 girada 90°: o comprimento passa do eixo X para o Z
    expect(panelAt([10, 0, 1.5], regions)).toBe("capo");
    expect(panelAt([11.5, 0, 0], regions)).toBeNull();
  });
});

describe("RegionsSchema", () => {
  it("aceita um regions.json válido", () => {
    expect(RegionsSchema.parse(regions)).toEqual(regions);
  });

  it("rejeita panel_key desconhecida", () => {
    expect(() =>
      RegionsSchema.parse({
        model: "x",
        paintMaterials: [],
        panels: { porta_magica: [{ center: [0, 0, 0], size: [1, 1, 1] }] },
      }),
    ).toThrow();
  });
});
