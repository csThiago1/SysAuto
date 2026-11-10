import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { describe, expect, it } from "vitest";
import { CAR_MODELS } from "./catalog";
import { PANEL_KEYS, type BodyType, type PanelKey } from "./panels";
import { panelAt, RegionsSchema, type Regions } from "./regions";

const PUBLIC = resolve(__dirname, "../../../apps/dscar-web/public/car-3d");
const MAX_GLB_BYTES = 3 * 1024 * 1024;

const ABSENT: Record<BodyType, PanelKey[]> = {
  hatch: ["cacamba", "porta_lateral_corredica"],
  sedan: ["cacamba", "porta_lateral_corredica"],
  suv: ["cacamba", "porta_lateral_corredica"],
  pickup: ["porta_tras_e", "porta_tras_d", "porta_lateral_corredica"],
  van: ["cacamba", "porta_tras_e", "porta_tras_d"],
};

const placeholders = CAR_MODELS.filter((m) => m.license === "PLACEHOLDER");

function loadRegions(file: string): Regions {
  return RegionsSchema.parse(JSON.parse(readFileSync(resolve(PUBLIC, "regions", file), "utf8")));
}

describe("modelos provisórios", () => {
  it("existem os 5", () => {
    expect(placeholders.map((m) => m.bodyType).sort()).toEqual(["hatch", "pickup", "sedan", "suv", "van"]);
  });

  describe.each(placeholders)("$key", (entry) => {
    const regions = loadRegions(entry.regionsFile);

    it("cobre as peças que a carroceria tem, e só elas", () => {
      const expected = PANEL_KEYS.filter((k) => !ABSENT[entry.bodyType].includes(k));
      expect(Object.keys(regions.panels).sort()).toEqual([...expected].sort());
      expect(regions.model).toBe(entry.key);
    });

    it("o centro de cada caixa cai na própria peça (nenhuma caixa engolida)", () => {
      for (const [key, boxes] of Object.entries(regions.panels)) {
        for (const box of boxes ?? []) expect(panelAt(box.center, regions), key).toBe(key);
      }
    });

    it("lado esquerdo em +x, direito espelhado em -x", () => {
      for (const [key, boxes] of Object.entries(regions.panels)) {
        if (!key.endsWith("_e")) continue;
        // van: a corrediça ocupa parte da lateral direita, então a lateral traseira não é espelho
        if (entry.bodyType === "van" && key === "lateral_tras_e") continue;
        const right = regions.panels[key.replace(/_e$/, "_d") as PanelKey] ?? [];
        expect(right, key).toHaveLength((boxes ?? []).length);
        (boxes ?? []).forEach((box, i) => {
          expect(box.center[0], key).toBeGreaterThan(0);
          expect(right[i]?.center).toEqual([-box.center[0], box.center[1], box.center[2]]);
        });
      }
    });

    it("glb ≤ 3 MB com lataria paint, vidros glass e rodas tire", async () => {
      const path = resolve(PUBLIC, entry.file);
      expect(statSync(path).size).toBeLessThanOrEqual(MAX_GLB_BYTES);
      const doc = await new NodeIO().read(path);
      const materials = doc.getRoot().listMaterials().map((m) => m.getName());
      expect(materials).toEqual(expect.arrayContaining(["paint", "glass", "tire"]));
      expect(regions.paintMaterials).toEqual(["paint"]);
      const mirror = doc.getRoot().listNodes().find((n) => n.getName() === "retrovisor_e");
      expect(mirror?.getTranslation()[0]).toBeGreaterThan(0);
      // malha com nome de peça (farol_e, teto, roda_tras_d...): o centro dela cai na caixa da peça
      const named = doc.getRoot().listNodes().filter((n) => (PANEL_KEYS as readonly string[]).includes(n.getName()));
      expect(named.length).toBeGreaterThan(10);
      for (const node of named) expect(panelAt(node.getTranslation(), regions), node.getName()).toBe(node.getName());
    });
  });
});
