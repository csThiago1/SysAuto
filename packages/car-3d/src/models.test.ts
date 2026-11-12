import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { beforeAll, describe, expect, it } from "vitest";
import { CAR_MODELS, resolveCarModel } from "./catalog";
import { PANEL_KEYS, type BodyType, type PanelKey } from "./panels";
import { panelAt, RegionsSchema, type RegionBox, type Regions, type Vec3 } from "./regions";

const PUBLIC = resolve(__dirname, "../../../apps/dscar-web/public/car-3d");
const MAX_GLB_BYTES = 3 * 1024 * 1024;
/** Fração mínima da área de lataria (paintMaterials) que cai em alguma peça. */
const MIN_PAINT_COVERAGE = 0.95;

const ABSENT: Record<BodyType, PanelKey[]> = {
  hatch: ["cacamba", "porta_lateral_corredica"],
  sedan: ["cacamba", "porta_lateral_corredica"],
  suv: ["cacamba", "porta_lateral_corredica"],
  pickup: ["porta_tras_e", "porta_tras_d", "porta_lateral_corredica"],
  van: ["cacamba", "porta_tras_e", "porta_tras_d"],
};

const placeholders = CAR_MODELS.filter((m) => m.license === "PLACEHOLDER");
const realModels = CAR_MODELS.filter((m) => m.license !== "PLACEHOLDER");

function loadRegions(file: string): Regions {
  return RegionsSchema.parse(JSON.parse(readFileSync(resolve(PUBLIC, "regions", file), "utf8")));
}

async function readGlb(file: string): Promise<Document> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  return io.read(resolve(PUBLIC, file));
}

/** `color`: material + célula 8×8 do UV na textura base (os Ddiaz pintam peças por célula de um atlas de cores). */
type Triangle = { material: string; color: string; v: [Vec3, Vec3, Vec3]; centroid: Vec3; area: number };

/** Triângulos do .glb no espaço do modelo (vértices, centróide e área), com o nome do material. */
function triangles(doc: Document): Triangle[] {
  const out: Triangle[] = [];
  const el: number[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const at = (i: number): Vec3 => {
        pos.getElement(i, el);
        const [x = 0, y = 0, z = 0] = el;
        return [
          m[0] * x + m[4] * y + m[8] * z + m[12],
          m[1] * x + m[5] * y + m[9] * z + m[13],
          m[2] * x + m[6] * y + m[10] * z + m[14],
        ];
      };
      const idx = prim.getIndices()?.getArray();
      const count = idx ? idx.length : pos.getCount();
      const material = prim.getMaterial()?.getName() ?? "";
      const uv = prim.getMaterial()?.getBaseColorTexture() ? prim.getAttribute("TEXCOORD_0") : null;
      for (let t = 0; t + 2 < count; t += 3) {
        const ids = [0, 1, 2].map((k) => (idx ? Number(idx[t + k]) : t + k));
        const [a, b, c] = ids.map(at) as [Vec3, Vec3, Vec3];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let color = material;
        if (uv) {
          const mid = [0, 1].map((d) => ids.reduce((s, i) => s + (uv.getElement(i, el)[d] ?? 0), 0) / 3);
          color += ` ${mid.map((m) => Math.floor(m * 8)).join(",")}`;
        }
        out.push({
          material,
          color,
          v: [a, b, c],
          centroid: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3],
          area: Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2,
        });
      }
    }
  }
  return out;
}

const inside = (box: RegionBox, p: Vec3): boolean =>
  panelAt(p, { model: "", paintMaterials: [], panels: { capo: [box] } }) === "capo";

type Range = [number, number];
/**
 * Onde havia emblema (espaço do modelo): caixa e eixo de onde se olha (`axis`, vindo do lado `sign`). Os raios de uma
 * grade 7×7 sobre a caixa têm de acertar todos uma mesma superfície lisa: sem furo, uma cor só e sem degrau (a
 * profundidade varia linear — a segunda diferença entre raios vizinhos fica em 3 mm; superfície inclinada passa).
 * Logo em outra cor, silhueta em relevo ou buraco no lugar do emblema quebram isso.
 */
type EmblemSpot = { name: string; box: [Range, Range, Range]; axis: 0 | 2; sign: 1 | -1 };

/** Miolo da roda (lado externo em x): quadrado de ±`half` em volta do centro (y, z). */
const hub = (name: string, x: Range, y: number, z: number, half: number): EmblemSpot => ({
  name,
  box: [x, [y - half, y + half], [z - half, z + half]],
  axis: 0,
  sign: x[0] > 0 ? 1 : -1,
});

const EMBLEM_SPOTS: Record<string, EmblemSpot[]> = {
  polo: [
    hub("logo VW roda diant. esq.", [0.79, 0.85], 0.2972, 1.2128, 0.012),
    hub("logo VW roda diant. dir.", [-0.86, -0.8], 0.2972, 1.2129, 0.012),
    hub("logo VW roda tras. esq.", [0.79, 0.85], 0.2972, -1.3503, 0.012),
    hub("logo VW roda tras. dir.", [-0.86, -0.8], 0.2972, -1.3502, 0.012),
  ],
  virtus: [
    hub("logo VW roda diant. esq.", [0.81, 0.87], 0.3301, 1.4022, 0.012),
    hub("logo VW roda diant. dir.", [-0.87, -0.81], 0.3301, 1.4026, 0.012),
    hub("logo VW roda tras. esq.", [0.8, 0.86], 0.3294, -1.2486, 0.012),
    hub("logo VW roda tras. dir.", [-0.86, -0.8], 0.3294, -1.2481, 0.012),
  ],
  onix: [{ name: "gravata dianteira no friso cromado", box: [[-0.1, 0.1], [0.695, 0.708], [2.2, 2.4]], axis: 2, sign: 1 }],
  spark_euv: [
    hub("gravata roda diant. esq.", [0.8, 0.86], 0.3295, 1.275, 0.02),
    hub("gravata roda diant. dir.", [-0.86, -0.8], 0.3295, 1.275, 0.02),
    hub("gravata roda tras. esq.", [0.8, 0.86], 0.327, -1.286, 0.02),
    hub("gravata roda tras. dir.", [-0.86, -0.8], 0.327, -1.286, 0.02),
  ],
};

/** Primeira superfície que o raio paralelo a `axis` (vindo de `sign`) encontra em (p, q) dentro da caixa. */
function firstHit(tris: Triangle[], spot: EmblemSpot, p: number, q: number): { color: string; depth: number } | null {
  const [i, j] = spot.axis === 0 ? [1, 2] : [0, 1];
  const [lo, hi] = spot.box[spot.axis];
  let best: { color: string; depth: number } | null = null;
  for (const t of tris) {
    const [a, b, c] = t.v;
    const det = (b[i] - a[i]) * (c[j] - a[j]) - (c[i] - a[i]) * (b[j] - a[j]);
    if (det === 0) continue;
    const u = ((p - a[i]) * (c[j] - a[j]) - (c[i] - a[i]) * (q - a[j])) / det;
    const w = ((b[i] - a[i]) * (q - a[j]) - (p - a[i]) * (b[j] - a[j])) / det;
    if (u < 0 || w < 0 || u + w > 1) continue;
    const depth = a[spot.axis] + u * (b[spot.axis] - a[spot.axis]) + w * (c[spot.axis] - a[spot.axis]);
    if (depth < lo || depth > hi) continue;
    if (!best || depth * spot.sign > best.depth * spot.sign) best = { color: t.color, depth };
  }
  return best;
}

describe("modelos 3D (todos)", () => {
  it("existem os 5 provisórios", () => {
    expect(placeholders.map((m) => m.bodyType).sort()).toEqual(["hatch", "pickup", "sedan", "suv", "van"]);
  });

  describe.each(CAR_MODELS)("$key", (entry) => {
    const regions = loadRegions(entry.regionsFile);

    it("cobre as peças que a carroceria tem, e só elas", () => {
      const expected = PANEL_KEYS.filter((k) => !ABSENT[entry.bodyType].includes(k));
      expect(Object.keys(regions.panels).sort()).toEqual([...expected].sort());
      expect(regions.model).toBe(entry.key);
    });

    it("nenhuma caixa engolida: algum ponto da grade 3×3×3 de cada caixa cai na própria peça", () => {
      const grid = [-0.4, 0, 0.4];
      for (const [key, boxes] of Object.entries(regions.panels)) {
        for (const { center: c, size: s, rotationY: r = 0 } of boxes ?? []) {
          const points = grid.flatMap((i) =>
            grid.flatMap((j) =>
              grid.map((k): Vec3 => {
                const [lx, lz] = [i * s[0], k * s[2]]; // eixo local da caixa → cena (inverso do giro de panelAt)
                return [c[0] + lx * Math.cos(r) + lz * Math.sin(r), c[1] + j * s[1], c[2] - lx * Math.sin(r) + lz * Math.cos(r)];
              }),
            ),
          );
          expect(points.some((p) => panelAt(p, regions) === key), `${key} ${JSON.stringify(c)}`).toBe(true);
        }
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
  });
});

describe.each(placeholders)("provisório $key", (entry) => {
  const regions = loadRegions(entry.regionsFile);

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
    // coluna C (fora da taxonomia) conta como lateral traseira
    for (const side of ["e", "d"]) {
      const coluna = doc.getRoot().listNodes().find((n) => n.getName() === `coluna_c_${side}`);
      if (coluna) expect(panelAt(coluna.getTranslation(), regions), coluna.getName()).toBe(`lateral_tras_${side}`);
    }
  });
});

describe("modelos definitivos", () => {
  it("catálogo: Polo, Virtus, Onix e Spark EUV antes dos provisórios", () => {
    expect(realModels.map((m) => m.key)).toEqual(["polo", "virtus", "onix", "spark_euv"]);
    expect(CAR_MODELS.slice(0, realModels.length)).toEqual(realModels);
    for (const m of realModels) {
      expect(m.file).toBe(`${m.key}.glb`);
      expect(m.regionsFile).toBe(`${m.key}.regions.json`);
      expect(m.author).not.toBe("");
      expect(m.sourceUrl).toMatch(/^https:\/\/sketchfab\.com\/3d-models\//);
    }
  });

  it("CREDITS.md (gerado por make-credits) traz título, autor e link de cada um", () => {
    const credits = readFileSync(resolve(__dirname, "../assets/CREDITS.md"), "utf8");
    for (const m of realModels) {
      expect(credits).toContain(`| \`${m.file}\` | ${m.bodyType} | ${m.title} | ${m.author} |`);
      expect(credits).toContain(m.sourceUrl);
    }
  });

  it("resolução: família → padrão da carroceria → provisório, respeitando NC", () => {
    const key = (make: string | null, family: string | null, bodyType: BodyType, allowNc: boolean): string =>
      resolveCarModel({ make, family, bodyType, allowNc }).key;
    expect(key("volkswagen", "polo", "hatch", true)).toBe("polo");
    expect(key("volkswagen", "polo", "hatch", false)).toBe("placeholder_hatch");
    expect(key("volkswagen", "virtus", "sedan", true)).toBe("virtus");
    expect(key("chevrolet", "onix", "hatch", false)).toBe("onix");
    expect(key("chevrolet", "onix_plus", "sedan", true)).toBe("onix");
    expect(key("chevrolet", "spark_euv", "suv", true)).toBe("spark_euv");
    expect(key("chevrolet", "spark_euv", "suv", false)).toBe("placeholder_suv");
    expect(key(null, null, "hatch", true)).toBe("polo");
    expect(key(null, null, "sedan", true)).toBe("virtus");
    expect(key(null, null, "sedan", false)).toBe("onix");
    expect(key(null, null, "suv", true)).toBe("placeholder_suv");
    expect(key(null, null, "pickup", true)).toBe("placeholder_pickup");
    expect(key(null, null, "van", true)).toBe("placeholder_van");
  });

  describe.each(realModels)("$key", (entry) => {
    const regions = loadRegions(entry.regionsFile);
    let tris: Triangle[] = [];

    beforeAll(async () => {
      expect(statSync(resolve(PUBLIC, entry.file)).size).toBeLessThanOrEqual(MAX_GLB_BYTES);
      tris = triangles(await readGlb(entry.file));
    });

    it("lataria: materiais de pintura existem e ≥ 95% da área cai em alguma peça", () => {
      const paint = new Set(regions.paintMaterials);
      expect(paint.size).toBeGreaterThan(0);
      const painted = tris.filter((t) => paint.has(t.material));
      expect(new Set(painted.map((t) => t.material))).toEqual(paint);
      const total = painted.reduce((s, t) => s + t.area, 0);
      const covered = painted.filter((t) => panelAt(t.centroid, regions) !== null).reduce((s, t) => s + t.area, 0);
      expect(covered / total).toBeGreaterThanOrEqual(MIN_PAINT_COVERAGE);
    });

    it("sem emblema: onde havia logo sobra uma superfície lisa, de uma cor, sem furo", () => {
      const spots = EMBLEM_SPOTS[entry.key] ?? [];
      expect(spots.length).toBeGreaterThan(0);
      for (const spot of spots) {
        const near = tris.filter((t) =>
          spot.box.every(([lo, hi], d) => {
            const c = t.v.map((p) => p[d]!);
            return Math.min(...c) <= hi && Math.max(...c) >= lo;
          }),
        );
        const [i, j] = spot.axis === 0 ? [1, 2] : [0, 1];
        const steps = [0, 1, 2, 3, 4, 5, 6].map((k) => k / 6);
        const [pi, pj] = [spot.box[i]!, spot.box[j]!];
        const hits = steps.map((s) =>
          steps.map((r) => firstHit(near, spot, pi[0] + s * (pi[1] - pi[0]), pj[0] + r * (pj[1] - pj[0]))),
        );
        expect(hits.flat().every(Boolean), `${spot.name}: furo`).toBe(true);
        const depth = (k: number, l: number): number => hits[k]![l]!.depth;
        expect(new Set(hits.flat().map((h) => h!.color)), `${spot.name}: cores`).toHaveProperty("size", 1);
        for (let k = 0; k < 7; k++) {
          for (let l = 1; l < 6; l++) {
            const along = depth(k, l - 1) - 2 * depth(k, l) + depth(k, l + 1);
            const across = depth(l - 1, k) - 2 * depth(l, k) + depth(l + 1, k);
            expect(Math.max(Math.abs(along), Math.abs(across)), `${spot.name}: degrau`).toBeLessThanOrEqual(0.003);
          }
        }
      }
    });

    it("toda caixa encosta na malha (modelo na convenção: frente +z, esquerda +x)", () => {
      for (const [key, boxes] of Object.entries(regions.panels)) {
        for (const box of boxes ?? []) {
          expect(tris.some((t) => inside(box, t.centroid)), `${key} ${JSON.stringify(box.center)}`).toBe(true);
        }
      }
    });
  });
});
