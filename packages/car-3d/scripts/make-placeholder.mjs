// Gera os 5 carros provisórios (caixas) e o regions.json de cada um, derivado das mesmas medidas.
// Rodar: npm run make-placeholder -w @paddock/car-3d
// Convenção (regions.ts): frente = +z, y para cima, lado esquerdo = +x. Unidade: metro.
// O ajuste fino das caixas é na tela /dev/car-3d; se ajustar lá, exporte e salve por cima do JSON.
import { mkdirSync, writeFileSync } from "node:fs";
import { Document, NodeIO } from "@gltf-transform/core";

const OUT = new URL("../../../apps/dscar-web/public/car-3d/", import.meta.url);

/**
 * c = vão livre (fundo da lataria), belt = linha da janela (topo da lataria), roof = teto.
 * cabFront/cabRear = cabine (vidros) em z. doorFront/bPillar/rearDoorRear = portas em z.
 */
const BODIES = {
  hatch: { L: 3.95, W: 1.72, c: 0.3, belt: 0.95, roof: 1.45, r: 0.31, frontAxle: 1.25, rearAxle: -1.25,
    cabFront: 0.55, cabRear: -1.9, doorFront: 0.55, bPillar: -0.45, rearDoorRear: -1.25 },
  sedan: { L: 4.5, W: 1.75, c: 0.3, belt: 0.95, roof: 1.46, r: 0.31, frontAxle: 1.31, rearAxle: -1.31,
    cabFront: 0.65, cabRear: -1.1, doorFront: 0.65, bPillar: -0.35, rearDoorRear: -1.2 },
  suv: { L: 4.35, W: 1.8, c: 0.4, belt: 1.1, roof: 1.68, r: 0.36, frontAxle: 1.31, rearAxle: -1.31,
    cabFront: 0.65, cabRear: -2.05, doorFront: 0.65, bPillar: -0.35, rearDoorRear: -1.25 },
  pickup: { L: 4.7, W: 1.8, c: 0.4, belt: 1.05, roof: 1.7, r: 0.36, frontAxle: 1.47, rearAxle: -1.47,
    cabFront: 0.95, cabRear: -0.35, doorFront: 0.95, bPillar: -0.3, rearDoorRear: null, bedFloor: 0.65 },
  van: { L: 5.0, W: 2.0, c: 0.35, belt: 1.1, roof: 2.3, r: 0.35, frontAxle: 1.85, rearAxle: -1.35,
    cabFront: 1.55, cabRear: -2.5, doorFront: 1.45, bPillar: 0.65, rearDoorRear: null, glassFrom: 0.65,
    slideRear: -0.5 },
};

const MATERIALS = {
  paint: { color: [0.8, 0.8, 0.8, 1], metallic: 0.3, roughness: 0.45 },
  glass: { color: [0.08, 0.11, 0.14, 1], metallic: 0.2, roughness: 0.08 },
  tire: { color: [0.04, 0.04, 0.04, 1], metallic: 0, roughness: 0.9 },
  trim: { color: [0.06, 0.06, 0.06, 1], metallic: 0.1, roughness: 0.6 },
  headlight: { color: [0.92, 0.93, 0.95, 1], metallic: 0.1, roughness: 0.15 },
  taillight: { color: [0.7, 0.04, 0.04, 1], metallic: 0.1, roughness: 0.2 },
};

const ROOF_T = 0.06; // espessura do teto
/** Recuo da cabine em relação à lateral (van: quase reta). */
const insetOf = (b) => (b.glassFrom === undefined ? 0.06 : 0.02);

const round = (n) => Math.round(n * 1000) / 1000;

/** Caixa por limites [x0,x1],[y0,y1],[z0,z1] → { center, size }. */
const box = ([x0, x1], [y0, y1], [z0, z1]) => ({
  center: [round((x0 + x1) / 2), round((y0 + y1) / 2), round((z0 + z1) / 2)],
  size: [round(x1 - x0), round(y1 - y0), round(z1 - z0)],
});
const mirror = (b) => ({ center: [-b.center[0], b.center[1], b.center[2]], size: b.size });
/** Peça com par esquerdo/direito: a caixa vem do lado esquerdo (+x) e o direito é o espelho. */
const pair = (panels, base, boxes) => {
  panels[`${base}_e`] = boxes;
  panels[`${base}_d`] = boxes.map(mirror);
};

/** Malhas do carro: [nome, material, forma] com forma = caixa ou roda. */
function parts(b) {
  const { L, W, c, belt, roof, r } = b;
  const hw = W / 2;
  const inset = insetOf(b);
  const out = [];
  const add = (name, material, bx) => out.push({ name, material, ...bx });
  const both = (name, material, bx) => {
    add(`${name}_e`, material, bx);
    add(`${name}_d`, material, mirror(bx));
  };

  if (b.bedFloor === undefined) {
    add("lataria", "paint", box([-hw, hw], [c, belt], [-L / 2, L / 2]));
  } else {
    add("lataria", "paint", box([-hw, hw], [c, belt], [b.cabRear, L / 2]));
    add("cacamba_fundo", "paint", box([-hw, hw], [c, b.bedFloor], [-L / 2, b.cabRear]));
    both("cacamba_lateral", "paint", box([hw - 0.06, hw], [b.bedFloor, belt], [-L / 2, b.cabRear]));
    add("tampa_cacamba", "paint", box([-hw + 0.06, hw - 0.06], [b.bedFloor, belt], [-L / 2, -L / 2 + 0.06]));
  }

  const glassRear = b.glassFrom ?? b.cabRear;
  add("vidros", "glass", box([-hw + inset, hw - inset], [belt, roof - ROOF_T], [glassRear, b.cabFront]));
  if (b.glassFrom !== undefined) {
    add("bau", "paint", box([-hw + inset, hw - inset], [belt, roof - ROOF_T], [b.cabRear, b.glassFrom]));
    both("vidro_tras", "glass", box([0.1, 0.8], [roof - 0.75, roof - 0.2], [-L / 2 - 0.01, -L / 2]));
  }
  add("teto", "paint", box([-hw + inset - 0.01, hw - inset + 0.01], [roof - ROOF_T, roof], [b.cabRear, b.cabFront]));
  if (b.glassFrom === undefined) {
    both("coluna_a", "paint", box([hw - inset - 0.03, hw - inset + 0.03], [belt, roof - ROOF_T], [b.cabFront - 0.11, b.cabFront + 0.01]));
    both("coluna_c", "paint", box([hw - inset - 0.03, hw - inset + 0.03], [belt, roof - ROOF_T], [b.cabRear - 0.01, b.cabRear + 0.11]));
  }
  both("retrovisor", "paint", box([hw - 0.02, hw + 0.14], [belt + 0.065, belt + 0.175], [b.cabFront - 0.24, b.cabFront - 0.16]));

  both("farol", "headlight", box([hw - 0.38, hw - 0.06], [belt - 0.18, belt - 0.06], [L / 2, L / 2 + 0.01]));
  add("grade", "trim", box([-hw + 0.45, hw - 0.45], [belt - 0.19, belt - 0.07], [L / 2, L / 2 + 0.01]));
  const tail = b.glassFrom === undefined ? [[hw - 0.26, hw - 0.04], [belt - 0.22, belt - 0.08]] : [[hw - 0.16, hw - 0.04], [c + 0.4, c + 0.7]];
  both("lanterna", "taillight", box(tail[0], tail[1], [-L / 2 - 0.01, -L / 2]));

  for (const [name, z] of [["roda_diant", b.frontAxle], ["roda_tras", b.rearAxle]]) {
    const wheel = { center: [round(hw - 0.07), r, z], radius: r, width: 0.22 };
    out.push({ name: `${name}_e`, material: "tire", ...wheel });
    out.push({ name: `${name}_d`, material: "tire", ...wheel, center: [-wheel.center[0], r, z] });
  }
  return out;
}

/** Caixas das peças (espaço do modelo), derivadas das mesmas medidas das malhas. */
function regions(key, b) {
  const { L, W, c, belt, roof, r } = b;
  const hw = W / 2;
  const inset = insetOf(b);
  // casca fina do lado esquerdo: o pneu sai além (hw + 0.04), e a caixa da lateral fica menor que a da roda
  const side = [hw - 0.02, hw + 0.01];
  const top = b.glassFrom === undefined ? belt + 0.02 : roof - 0.08; // van: lataria sobe até o teto
  const bumperTop = belt - 0.2;
  const rearBumperTop = c + 0.3;
  const p = {};

  p.parachoque_diant = [
    box([-hw - 0.02, hw + 0.02], [c - 0.02, bumperTop], [L / 2 - 0.05, L / 2 + 0.04]),
    box(side, [c - 0.02, bumperTop], [L / 2 - 0.25, L / 2 - 0.05]),
    mirror(box(side, [c - 0.02, bumperTop], [L / 2 - 0.25, L / 2 - 0.05])),
  ];
  p.parachoque_tras = [
    box([-hw - 0.02, hw + 0.02], [c - 0.02, rearBumperTop], [-L / 2 - 0.04, -L / 2 + 0.05]),
    box(side, [c - 0.02, rearBumperTop], [-L / 2 + 0.05, -L / 2 + 0.25]),
    mirror(box(side, [c - 0.02, rearBumperTop], [-L / 2 + 0.05, -L / 2 + 0.25])),
  ];
  p.capo = [box([-hw + 0.02, hw - 0.02], [belt - 0.05, belt + 0.04], [b.cabFront, L / 2 + 0.02])];
  p.teto = [box([-hw + inset - 0.02, hw - inset + 0.02], [roof - ROOF_T - 0.02, roof + 0.04], [b.cabRear - 0.02, b.cabFront + 0.02])];

  // picape: a tampa da caçamba tem 6 cm; a caixa pega também a face de dentro dela
  const tampaDepth = b.bedFloor === undefined ? 0.04 : 0.08;
  const tampa = [box([-hw + 0.04, hw - 0.04], [rearBumperTop, b.glassFrom === undefined ? belt + 0.04 : roof - 0.04], [-L / 2 - 0.04, -L / 2 + tampaDepth])];
  const deck = b.cabRear + L / 2;
  if (b.bedFloor === undefined && deck > 0.3) {
    tampa.push(box([-hw + 0.04, hw - 0.04], [belt - 0.05, belt + 0.04], [-L / 2 + 0.04, b.cabRear]));
  }
  p.tampa_tras = tampa;
  if (b.bedFloor !== undefined) {
    p.cacamba = [box([-hw + 0.05, hw - 0.05], [b.bedFloor - 0.03, belt + 0.02], [-L / 2 + tampaDepth, b.cabRear])];
  }

  pair(p, "paralama_diant", [box(side, [c, belt + 0.02], [b.doorFront, L / 2 + 0.02])]);
  pair(p, "porta_diant", [box(side, [c + 0.12, belt + 0.02], [b.bPillar, b.doorFront])]);
  const doorsRear = b.rearDoorRear ?? b.bPillar;
  if (b.rearDoorRear !== null) pair(p, "porta_tras", [box(side, [c + 0.12, belt + 0.02], [b.rearDoorRear, b.bPillar])]);
  pair(p, "soleira", [box(side, [c - 0.02, c + 0.12], [doorsRear, b.doorFront])]);

  if (b.slideRear === undefined) {
    pair(p, "lateral_tras", [box(side, [c, top], [-L / 2 - 0.02, doorsRear])]);
  } else {
    // van: a corrediça é só do lado direito (-x); à esquerda a lateral vai até a porta da frente
    // dividida na linha da janela: inteira, a caixa ficaria maior que a da roda e engoliria o pneu
    const tall = (z) => [box(side, [c, belt + 0.02], z), box(side, [belt + 0.02, top], z)];
    p.lateral_tras_e = tall([-L / 2 - 0.02, b.bPillar]);
    p.lateral_tras_d = tall([-L / 2 - 0.02, b.slideRear]).map(mirror);
    p.porta_lateral_corredica = [mirror(box(side, [c, top], [b.slideRear, b.bPillar]))];
  }

  pair(p, "retrovisor", [box([hw - 0.04, hw + 0.16], [belt + 0.045, belt + 0.195], [b.cabFront - 0.26, b.cabFront - 0.14])]);
  if (b.glassFrom === undefined) {
    pair(p, "coluna_a", [box([hw - inset - 0.05, hw - inset + 0.05], [belt, roof - ROOF_T + 0.01], [b.cabFront - 0.13, b.cabFront + 0.03])]);
  } else {
    pair(p, "coluna_a", [box([hw - inset - 0.04, hw - inset + 0.02], [belt, roof - ROOF_T + 0.01], [b.cabFront - 0.1, b.cabFront + 0.03])]);
  }
  const glassX = b.glassFrom === undefined ? hw - inset - 0.04 : hw - inset - 0.06;
  p.parabrisa = [box([-glassX, glassX], [belt + 0.01, roof - ROOF_T - 0.01], [b.cabFront - 0.04, b.cabFront + 0.04])];
  p.vidro_tras = b.glassFrom === undefined
    ? [box([-glassX, glassX], [belt + 0.01, roof - ROOF_T - 0.01], [b.cabRear - 0.04, b.cabRear + 0.04])]
    : [box([-0.82, 0.82], [roof - 0.77, roof - 0.18], [-L / 2 - 0.04, -L / 2 + 0.03])];

  pair(p, "farol", [box([hw - 0.4, hw - 0.04], [belt - 0.2, belt - 0.04], [L / 2 - 0.04, L / 2 + 0.05])]);
  p.grade = [box([-hw + 0.43, hw - 0.43], [belt - 0.2, belt - 0.06], [L / 2 - 0.04, L / 2 + 0.05])];
  const tail = b.glassFrom === undefined ? [[hw - 0.28, hw - 0.02], [belt - 0.24, belt - 0.06]] : [[hw - 0.18, hw - 0.02], [c + 0.38, c + 0.72]];
  pair(p, "lanterna", [box(tail[0], tail[1], [-L / 2 - 0.05, -L / 2 + 0.04])]);

  const wheel = (z) => [box([hw - 0.2, hw + 0.06], [-0.03, 2 * r + 0.03], [z - r - 0.03, z + r + 0.03])];
  pair(p, "roda_diant", wheel(b.frontAxle));
  pair(p, "roda_tras", wheel(b.rearAxle));

  return { model: key, paintMaterials: ["paint"], panels: p };
}

function boxGeometry([sx, sy, sz]) {
  const [x, y, z] = [sx / 2, sy / 2, sz / 2];
  // 6 faces: normal + 4 cantos em ordem anti-horária vista de fora
  const faces = [
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]],
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
  ];
  const pos = [], nor = [], idx = [];
  faces.forEach(([n, quad], f) => {
    for (const v of quad) pos.push(...v), nor.push(...n);
    idx.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3);
  });
  return { pos, nor, idx };
}

/** Cilindro com eixo em x (roda). */
function wheelGeometry(radius, width, seg = 32) {
  const pos = [], nor = [], idx = [];
  const hx = width / 2;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const [cy, cz] = [Math.cos(a), Math.sin(a)];
    pos.push(hx, cy * radius, cz * radius, -hx, cy * radius, cz * radius);
    nor.push(0, cy, cz, 0, cy, cz);
  }
  for (let i = 0; i < seg; i++) {
    const k = i * 2;
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  for (const sx of [1, -1]) {
    const center = pos.length / 3;
    pos.push(sx * hx, 0, 0);
    nor.push(sx, 0, 0);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(sx * hx, Math.cos(a) * radius, Math.sin(a) * radius);
      nor.push(sx, 0, 0);
    }
    for (let i = 0; i < seg; i++) {
      const [a, b] = [center + 1 + i, center + 2 + i];
      idx.push(...(sx > 0 ? [center, a, b] : [center, b, a]));
    }
  }
  return { pos, nor, idx };
}

async function writeModel(bodyType, b) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mats = Object.fromEntries(
    Object.entries(MATERIALS).map(([name, m]) => [
      name,
      doc.createMaterial(name).setBaseColorFactor(m.color).setMetallicFactor(m.metallic).setRoughnessFactor(m.roughness),
    ]),
  );
  const scene = doc.createScene(`placeholder_${bodyType}`);
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  for (const part of parts(b)) {
    const g = part.radius ? wheelGeometry(part.radius, part.width) : boxGeometry(part.size);
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", accessor("VEC3", new Float32Array(g.pos)))
      .setAttribute("NORMAL", accessor("VEC3", new Float32Array(g.nor)))
      .setIndices(accessor("SCALAR", new Uint16Array(g.idx)))
      .setMaterial(mats[part.material]);
    const mesh = doc.createMesh(part.name).addPrimitive(prim);
    scene.addChild(doc.createNode(part.name).setMesh(mesh).setTranslation(part.center));
  }
  await new NodeIO().write(new URL(`placeholder-${bodyType}.glb`, OUT).pathname, doc);
}

mkdirSync(new URL("regions/", OUT), { recursive: true });
for (const [bodyType, b] of Object.entries(BODIES)) {
  await writeModel(bodyType, b);
  const json = regions(`placeholder_${bodyType}`, b);
  writeFileSync(new URL(`regions/placeholder-${bodyType}.regions.json`, OUT), `${JSON.stringify(json, null, 2)}\n`);
}
