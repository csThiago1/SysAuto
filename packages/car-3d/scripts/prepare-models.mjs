// Prepara os modelos definitivos a partir dos .glb baixados do Sketchfab pelo Thiago.
// Rodar: npm run prepare-models -w @paddock/car-3d [-- <key>...]   (padrão: todos de MODELS)
// Origem: ~/Downloads/car-3d/<src> (ou CAR3D_SRC). Saída: apps/dscar-web/public/car-3d/<key>.glb e
// regions/<key>.regions.json. Passos:
//   1. apaga interior, emblemas e placas: nós por nome e peças soltas (componentes conexos) por caixa;
//   2. normaliza para a convenção de regions.ts: metro, frente +z, esquerda +x, chão em y = 0, centro em x/z;
//      vidros escurecidos e sem transmissão (sem interior, vidro transparente mostraria o carro oco);
//   3. otimiza com o CLI do glTF Transform (npx; meshopt em vez de draco: o decoder do meshopt vem no
//      bundle do three, o do draco o drei busca no gstatic, o que quebraria o app offline);
//   4. escreve o regions.json a partir das medidas de LANDMARKS (tiradas dos nós com nome de cada .glb,
//      ou do bounding box onde não há nome). Ajuste fino na tela /dev/car-3d volta para LANDMARKS.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { LANDMARKS, regionsFor } from "./model-regions.mjs";

const OUT = new URL("../../../apps/dscar-web/public/car-3d/", import.meta.url);
const SRC = process.env.CAR3D_SRC ?? join(homedir(), "Downloads/car-3d");

/** Caixa [[x0,x1],[y0,y1],[z0,z1]] no espaço já normalizado (metros, frente +z, esquerda +x). */
const MODELS = {
  polo: {
    src: "polo.glb",
    scale: 100,
    turn: false,
    dropNodes: /^(INTERIOR)$/,
    dropParts: [
      [[-0.3, 0.28], [0.4, 0.535], [1.99, 2.05]], // placa dianteira
      [[-0.1, 0.08], [0.53, 0.69], [1.9, 2.03]], // logo VW dianteiro
      [[-0.3, 0.28], [0.41, 0.54], [-2.045, -1.99]], // placa traseira
      [[-0.07, 0.05], [0.79, 0.92], [-1.97, -1.94]], // logo VW traseiro
      [[-0.1, 0.07], [0.74, 0.775], [-1.97, -1.95]], // letreiro POLO
      [[-0.6, -0.45], [0.715, 0.742], [-1.925, -1.88]], // letreiro 170 TSI
    ],
    paint: ["CarPaint"],
    glass: ["windows"],
    simplifyError: 0.0001,
  },
  virtus: {
    src: "virtus.glb",
    scale: 100,
    turn: false,
    dropNodes: /^(INTERIOR)$/,
    dropParts: [
      [[-0.21, 0.21], [0.48, 0.63], [2.25, 2.29]], // placa dianteira e letras
      [[-0.09, 0.09], [0.64, 0.8], [2.16, 2.245]], // logo VW dianteiro
      [[-0.21, 0.215], [0.76, 0.91], [-2.2, -2.14]], // placa traseira e letras
      [[-0.05, 0.05], [0.955, 1.05], [-2.22, -2.18]], // logo VW traseiro
      [[-0.13, 0.13], [0.705, 0.735], [-2.195, -2.185]], // letreiro VIRTUS
      [[-0.49, -0.425], [0.705, 0.735], [-2.17, -2.15]], // letreiro TSI
    ],
    paint: ["CarP"],
    glass: ["Windwos", "D_glass"],
    simplifyError: 0.0001,
  },
  onix: {
    src: "onix.glb",
    scale: 1,
    turn: true, // a frente vem em -z
    // onix_90_26: as duas gravatas (frente e traseira); frontbump: a placa traseira, apesar do nome
    // group_2: letreiro ONIX
    dropNodes: /^(onix_90_26|frontbump|group_2)$/,
    dropParts: [[[-0.1, 0.1], [0.99, 1.06], [-2.32, -2.29]]], // contorno cromado da gravata traseira
    // contorno cromado da gravata dianteira: fundido na moldura da grade
    cuts: [{ mesh: /^group_1_group_1\.1/, box: [[-0.12, 0.12], [0.675, 0.74], [2.27, 2.34]] }],
    paint: ["primary"],
    glass: ["onix_90_8.0"], // "glass" é a lente dos faróis
    simplifyError: 0.0001,
  },
  spark_euv: {
    src: "spark_euv.glb",
    scale: 100,
    turn: false,
    // INT.006 = interior; 2713/2720 = gravatas; 11.014–019 = gravatas das rodas; 289/290.002/94.004 = placas;
    // ACTIVE, SPARK, 2717 e EUV1 (portas) = letreiros
    dropNodes:
      /^(INT\.006|polySurface2713\.00[345]|polySurface2720\.00[345]|polySurface11\.01[4-9]|polySurface289(\.001)?|polySurface290\.002|polySurface94\.004|pasted__ACTIVE_Logo\.001|pasted__SPARK\.001|polySurface2717\.00[23]|pasted__EUV1\.00[3678])$/,
    dropParts: [],
    paint: ["EXT_CarPaint"],
    glass: ["Windows"],
    simplifyError: 0.0002, // 954 mil triângulos no original
  },
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function transformPoint(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** Itera as primitivas com a posição de cada vértice no espaço da cena. */
function* primitives(doc) {
  const nodes = [];
  doc.getRoot().listScenes()[0].traverse((n) => nodes.push(n));
  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const v = [];
      const points = Array.from({ length: pos.getCount() }, (_, i) => transformPoint(world, pos.getElement(i, v)));
      yield { node, prim, points };
    }
  }
}

function sceneBounds(doc) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { prim, points } of primitives(doc)) {
    const idx = prim.getIndices()?.getArray();
    for (const i of idx ?? points.keys()) {
      for (let d = 0; d < 3; d++) {
        min[d] = Math.min(min[d], points[i][d]);
        max[d] = Math.max(max[d], points[i][d]);
      }
    }
  }
  return { min, max };
}

const within = (box, min, max) => box.every(([a, b], d) => min[d] >= a && max[d] <= b);

/**
 * Apaga as peças soltas (componentes conexos por posição) inteiramente dentro de alguma caixa e,
 * nas malhas de `cuts` (emblema fundido numa peça maior), os triângulos com centro dentro da caixa.
 * `toNorm` leva um ponto da cena original para o espaço normalizado, onde as caixas estão.
 */
function dropParts(doc, boxes, cuts, toNorm) {
  let dropped = 0;
  for (const { node, prim, points } of primitives(doc)) {
    const indices = prim.getIndices();
    if (!indices) continue;
    const idx = indices.getArray();
    const parent = Int32Array.from(points.keys());
    const find = (a) => {
      while (parent[a] !== a) a = parent[a] = parent[parent[a]];
      return a;
    };
    const seen = new Map();
    points.forEach((p, i) => {
      const key = p.map((c) => Math.round(c * 1e6)).join(",");
      const j = seen.get(key);
      if (j === undefined) seen.set(key, i);
      else parent[find(i)] = find(j);
    });
    for (let t = 0; t < idx.length; t += 3) {
      parent[find(idx[t + 1])] = find(idx[t]);
      parent[find(idx[t + 2])] = find(idx[t]);
    }
    const comps = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      const r = find(idx[t]);
      let c = comps.get(r);
      if (!c) comps.set(r, (c = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
      for (let k = 0; k < 3; k++) {
        const q = toNorm(points[idx[t + k]]);
        for (let d = 0; d < 3; d++) {
          c.min[d] = Math.min(c.min[d], q[d]);
          c.max[d] = Math.max(c.max[d], q[d]);
        }
      }
    }
    const drop = new Set([...comps].filter(([, c]) => boxes.some((b) => within(b, c.min, c.max))).map(([r]) => r));
    const myCuts = cuts.filter((c) => c.mesh.test(node.getName())).map((c) => c.box);
    const cut = (t) => {
      if (myCuts.length === 0) return false;
      const c = [0, 1, 2].map((d) => [0, 1, 2].reduce((sum, k) => sum + toNorm(points[idx[t + k]])[d], 0) / 3);
      return myCuts.some((b) => within(b, c, c));
    };
    if (drop.size === 0 && myCuts.length === 0) continue;
    const kept = [];
    for (let t = 0; t < idx.length; t += 3) {
      if (drop.has(find(idx[t])) || cut(t)) dropped++;
      else kept.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    indices.setArray(new Uint32Array(kept));
  }
  return dropped;
}

async function prepare(key, cfg) {
  const doc = await io.read(join(SRC, cfg.src));
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  for (const node of root.listNodes()) if (cfg.dropNodes.test(node.getName())) node.dispose();

  // normalização: escala, meia-volta em y quando a frente vem em -z, chão em 0, centro em x/z
  const b = sceneBounds(doc);
  const s = cfg.scale;
  const sign = cfg.turn ? -1 : 1;
  const center = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
  const toNorm = ([x, y, z]) => [sign * (x - center[0]) * s, (y - center[1]) * s, sign * (z - center[2]) * s];
  const dropped = dropParts(doc, cfg.dropParts, cfg.cuts ?? [], toNorm);
  const car = doc
    .createNode(key)
    .setScale([s, s, s])
    .setRotation(cfg.turn ? [0, 1, 0, 0] : [0, 0, 0, 1])
    .setTranslation(toNorm([0, 0, 0]));
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    car.addChild(child);
  }
  scene.addChild(car);

  for (const m of root.listMaterials()) {
    m.setExtension("KHR_materials_transmission", null);
    if (cfg.glass.includes(m.getName())) m.setBaseColorFactor([0.02, 0.025, 0.03, 0.88]);
  }
  const names = new Set(root.listMaterials().map((m) => m.getName()));
  for (const n of [...cfg.paint, ...cfg.glass]) if (!names.has(n)) throw new Error(`${key}: material ${n} não existe`);

  const tmp = join(mkdtempSync(join(tmpdir(), "car3d-")), `${key}.glb`);
  await io.write(tmp, doc);
  const out = new URL(`${key}.glb`, OUT).pathname;
  execFileSync(
    "npx",
    [
      "--yes",
      "@gltf-transform/cli@4.5.1",
      "optimize",
      tmp,
      out,
      "--compress", "meshopt",
      "--texture-compress", "webp",
      "--texture-size", "1024",
      "--simplify-error", String(cfg.simplifyError),
      "--palette", "false", // não fundir materiais: a lataria é achada pelo nome
      "--instance", "false",
    ],
    { stdio: "inherit" },
  );
  console.log(`${key}: ${dropped} triângulos de emblema/placa removidos`);
}

// --regions: só reescreve os regions.json (os .glb já estão em public/)
const regionsOnly = process.argv.includes("--regions");
const args = process.argv.slice(2).filter((a) => a !== "--regions");
for (const key of args.length ? args : Object.keys(MODELS)) {
  const cfg = MODELS[key];
  if (!cfg) throw new Error(`modelo desconhecido: ${key}`);
  if (!regionsOnly) await prepare(key, cfg);
  if (LANDMARKS[key]) {
    const regions = regionsFor(key, LANDMARKS[key], cfg.paint);
    writeFileSync(new URL(`regions/${key}.regions.json`, OUT), `${JSON.stringify(regions, null, 2)}\n`);
  }
}
