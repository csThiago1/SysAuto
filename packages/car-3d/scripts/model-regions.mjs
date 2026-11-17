// Caixas das peças dos modelos definitivos, derivadas de medidas de cada .glb já normalizado
// (metro, frente +z, esquerda +x, chão em y = 0). Usado por prepare-models.mjs.
//
// Medidas do lado esquerdo (+x); o direito é o espelho. Origem dos números: nós com nome (portas,
// para-brisa, vidro traseiro, tampa, faróis, lanternas, rodas, retrovisor) no Polo, Virtus e Spark EUV;
// no Onix (sem nomes úteis), as malhas por material (vidro, luzes, rodas) e o bounding box do carro.
// Ajuste fino feito na tela /dev/car-3d volta para cá.
//
// Precedência de panelAt: a caixa de menor volume vence. As grandes (capô, teto, portas, laterais,
// para-choques) se repartem quase sem sobrepor; as pequenas (faróis, lanternas, grade, retrovisores,
// rodas, colunas A, vidros em degraus) ficam por cima.

const PAD = 0.03;
const round = (n) => Math.round(n * 1000) / 1000;

const box = ([x0, x1], [y0, y1], [z0, z1]) => ({
  center: [round((x0 + x1) / 2), round((y0 + y1) / 2), round((z0 + z1) / 2)],
  size: [round(x1 - x0), round(y1 - y0), round(z1 - z0)],
});
const grow = ([x, y, z], d = PAD) => box([x[0] - d, x[1] + d], [y[0] - d, y[1] + d], [z[0] - d, z[1] + d]);
const mirror = (b) => ({ center: [-b.center[0], b.center[1], b.center[2]], size: b.size });
const pair = (panels, base, boxes) => {
  panels[`${base}_e`] = boxes;
  panels[`${base}_d`] = boxes.map(mirror);
};

/**
 * Degraus que seguem um vidro inclinado (para-brisa, vidro traseiro, coluna A): `low` e `high` são
 * [z, y] das pontas da linha; cada degrau cobre uma faixa de altura e a faixa de z da linha nela.
 */
function steps(xRange, low, high, n, pad, zShift = [0, 0]) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const [za, zb] = [i / n, (i + 1) / n].map((t) => low[0] + (high[0] - low[0]) * t);
    const [ya, yb] = [i / n, (i + 1) / n].map((t) => low[1] + (high[1] - low[1]) * t);
    out.push(box(xRange, [ya - pad, yb + pad], [Math.min(za, zb) - pad + zShift[0], Math.max(za, zb) + pad + zShift[1]]));
  }
  return out;
}

export function regionsFor(key, m, paintMaterials) {
  const { hw, roof, zF, zR, wheel, lid } = m;
  const top = roof - m.roofBand; // abaixo: portas e laterais; acima: teto
  const side = [hw - m.sideDepth, hw + 0.08];
  const archF = wheel.front + wheel.r + PAD;
  const archR = wheel.rear - wheel.r - PAD;
  const hood = [m.bumperF, m.windshield.base[1] + m.cowl];
  const p = {};

  p.parachoque_diant = [box([-hw - 0.08, hw + 0.08], [0, m.bumperF], [archF, zF + 0.06])];
  p.parachoque_tras = [box([-hw - 0.08, hw + 0.08], [0, m.bumperR], [zR - 0.06, archR])];
  p.capo = [box([-m.hoodX, m.hoodX], hood, [m.windshield.base[0], zF + 0.06])];
  pair(p, "paralama_diant", [
    box([m.hoodX, hw + 0.08], [0.05, hood[1]], [m.doors.front[1], archF]),
    box([m.hoodX, hw + 0.08], hood, [archF, zF + 0.06]),
  ]);

  pair(p, "porta_diant", [box(side, [m.doorBottom, top], m.doors.front)]);
  pair(p, "porta_tras", [box(side, [m.doorBottom, top], m.doors.rear)]);
  pair(p, "soleira", [box(side, [0.05, m.doorBottom], [archR + 2 * (wheel.r + PAD), archF - 2 * (wheel.r + PAD)])]);
  // atrás da porta traseira: sobre a roda e, mais atrás, só por fora da tampa (coluna C incluída)
  const behind = Math.max(archR, lid.z[1]);
  pair(p, "lateral_tras", [
    box(side, [0.05, top], [behind, m.doors.rear[0]]),
    box([lid.x + 0.01, hw + 0.08], [m.bumperR, top], [zR - 0.06, behind]),
  ]);

  p.teto = [box([-hw + 0.1, hw - 0.1], [top, roof + 0.16], m.roofZ)]; // + barras e antena
  p.tampa_tras = [grow([[-lid.x, lid.x], lid.y, lid.z])];

  const ws = m.windshield;
  p.parabrisa = steps([-ws.x, ws.x], ws.base, ws.top, 4, 0.07);
  const rg = m.rearGlass;
  p.vidro_tras = steps([-rg.x, rg.x], rg.base, rg.top, 3, 0.07);
  // coluna A: degraus na borda do para-brisa, um pouco para trás dele (onde começa o vidro da porta)
  pair(p, "coluna_a", steps([ws.x - 0.07, ws.x + 0.12], ws.base, ws.top, 4, 0.03, [-0.14, 0]));

  pair(p, "retrovisor", m.mirror.map((b) => grow(b)));
  pair(p, "farol", m.headlight.map((b) => grow(b, 0.02)));
  pair(p, "lanterna", m.taillight.map((b) => grow(b, 0.02)));
  p.grade = m.grille.map((g) => grow(g, 0.02));
  // para dentro, a caixa da roda pega também a caixa de roda (forro do para-lama)
  const tire = (z) => [box([wheel.x[0] - 0.12, wheel.x[1] + PAD], [-PAD, 2 * wheel.r + PAD], [z - wheel.r - PAD, z + wheel.r + PAD])];
  pair(p, "roda_diant", tire(wheel.front));
  pair(p, "roda_tras", tire(wheel.rear));

  return { model: key, paintMaterials, panels: p };
}

/**
 * hw: meia largura da lataria (sem retrovisor); roof: topo do teto; roofBand: altura da faixa do teto;
 * zF/zR: frente e traseira; sideDepth: profundidade das caixas laterais; wheel: raio, faixa x do pneu
 * esquerdo e z dos eixos; doorBottom: base das portas; doors: z [traseira, dianteira] de cada porta;
 * bumperF/bumperR: topo dos para-choques; hoodX: meia largura do capô; cowl: quanto o capô sobe acima
 * da base do para-brisa; windshield/rearGlass: meia largura e [z, y] da base e do topo; lid: tampa
 * traseira (meia largura, y, z); roofZ: z do teto; headlight/taillight/mirror: listas de caixas do lado
 * esquerdo; grille: caixas da grade.
 */
export const LANDMARKS = {
  polo: {
    hw: 0.87,
    roof: 1.437,
    roofBand: 0.13,
    zF: 2.04,
    zR: -2.04,
    sideDepth: 0.32,
    wheel: { r: 0.298, x: [0.631, 0.822], front: 1.212, rear: -1.35 },
    doorBottom: 0.27,
    doors: { front: [-0.34, 0.76], rear: [-1.216, -0.34] },
    bumperF: 0.584,
    bumperR: 0.646,
    hoodX: 0.66,
    cowl: 0.12,
    windshield: { x: 0.717, base: [1.065, 0.926], top: [0.204, 1.344] },
    rearGlass: { x: 0.631, base: [-1.89, 1.014], top: [-1.469, 1.306] },
    lid: { x: 0.638, y: [0.646, 1.38], z: [-1.967, -1.383] },
    roofZ: [-1.47, 0.24],
    headlight: [[[0.416, 0.797], [0.584, 0.748], [1.532, 1.918]]],
    taillight: [[[0.506, 0.77], [0.744, 0.968], [-1.9, -1.603]]],
    mirror: [[[0.8, 0.982], [0.966, 1.068], [0.474, 0.618]]],
    grille: [
      [[-0.396, 0.396], [0.6, 0.74], [1.85, 2.04]],
      [[-0.339, 0.339], [0.222, 0.476], [1.747, 1.884]],
    ],
  },
  virtus: {
    hw: 0.87,
    roof: 1.505,
    roofBand: 0.13,
    zF: 2.285,
    zR: -2.285,
    sideDepth: 0.32,
    wheel: { r: 0.33, x: [0.638, 0.845], front: 1.403, rear: -1.249 },
    doorBottom: 0.34,
    doors: { front: [-0.15, 0.92], rear: [-1.113, -0.15] },
    bumperF: 0.66,
    bumperR: 0.675,
    hoodX: 0.66,
    cowl: 0.12,
    windshield: { x: 0.705, base: [1.256, 0.991], top: [0.395, 1.409] },
    rearGlass: { x: 0.605, base: [-1.822, 1.159], top: [-1.066, 1.413] },
    lid: { x: 0.627, y: [0.675, 1.177], z: [-2.217, -1.445] },
    roofZ: [-1.09, 0.42],
    headlight: [[[0.431, 0.798], [0.677, 0.855], [1.728, 2.179]]],
    // lanterna na lataria e o pedaço dela na tampa
    taillight: [
      [[0.572, 0.78], [0.838, 0.989], [-2.142, -1.725]],
      [[0.335, 0.579], [0.849, 0.988], [-2.193, -2.112]],
    ],
    mirror: [[[0.75, 0.989], [0.952, 1.153], [0.528, 0.938]]],
    grille: [
      [[-0.449, 0.449], [0.612, 0.801], [2.089, 2.28]],
      [[-0.328, 0.328], [0.286, 0.54], [2.01, 2.148]],
    ],
  },
  onix: {
    hw: 0.92,
    roof: 1.567,
    roofBand: 0.13,
    zF: 2.367,
    zR: -2.367,
    sideDepth: 0.32,
    wheel: { r: 0.335, x: [0.679, 0.924], front: 1.476, rear: -1.287 },
    doorBottom: 0.27,
    doors: { front: [-0.11, 0.98], rear: [-1.177, -0.11] },
    bumperF: 0.67,
    bumperR: 0.697,
    hoodX: 0.7,
    cowl: 0.12,
    windshield: { x: 0.75, base: [1.346, 0.955], top: [0.45, 1.49] },
    rearGlass: { x: 0.766, base: [-1.826, 1.114], top: [-1.0, 1.49] },
    lid: { x: 0.643, y: [0.697, 1.208], z: [-2.32, -1.792] },
    roofZ: [-1.05, 0.5],
    headlight: [[[0.494, 0.832], [0.673, 0.874], [1.691, 2.192]]],
    taillight: [[[0.401, 0.777], [0.932, 1.063], [-2.275, -2.016]]],
    mirror: [[[0.8, 1.088], [1.06, 1.163], [0.722, 0.931]]],
    grille: [[[-0.5, 0.5], [0.33, 0.8], [2.1, 2.37]]],
  },
  spark_euv: {
    hw: 0.876,
    roof: 1.607,
    roofBand: 0.13,
    zF: 2.005,
    zR: -2.005,
    sideDepth: 0.32,
    wheel: { r: 0.327, x: [0.64, 0.872], front: 1.269, rear: -1.292 },
    doorBottom: 0.36,
    doors: { front: [-0.21, 0.845], rear: [-1.193, -0.21] },
    bumperF: 0.75,
    bumperR: 0.673,
    hoodX: 0.7,
    cowl: 0.12,
    windshield: { x: 0.752, base: [1.091, 1.076], top: [0.24, 1.575] },
    rearGlass: { x: 0.618, base: [-1.927, 1.186], top: [-1.773, 1.565] },
    lid: { x: 0.622, y: [0.673, 1.566], z: [-1.999, -1.764] },
    roofZ: [-1.8, 0.26],
    headlight: [[[0.38, 0.692], [0.757, 0.971], [1.78, 1.9]]],
    taillight: [[[0.61, 0.724], [0.497, 1.053], [-1.918, -1.848]]],
    mirror: [[[0.86, 1.03], [1.08, 1.26], [0.48, 0.78]]],
    grille: [
      [[-0.38, 0.38], [0.757, 0.971], [1.85, 2.005]],
      [[-0.346, 0.346], [0.242, 0.641], [1.85, 2.0]],
    ],
  },
};
