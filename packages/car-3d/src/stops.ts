import type { CameraView, PanelKey } from "./panels";

export type StopKey =
  | "frente"
  | "lado_direito"
  | "lado_esquerdo"
  | "traseira"
  | "teto"
  | "interior_itens"
  | "pertences";

export type Stop = { key: StopKey; label: string; slots: string[]; panels: PanelKey[]; view: CameraView };

/** As 7 paradas (spec 5.2), na ordem sugerida. Slots = fotos obrigatórias da parada. */
export const STOPS: Stop[] = [
  {
    key: "frente",
    label: "Frente",
    slots: ["frente", "diag_diant"],
    panels: ["parachoque_diant", "capo", "parabrisa", "farol_e", "farol_d", "grade"],
    view: "front",
  },
  {
    key: "lado_direito",
    label: "Lado direito",
    slots: ["lateral_dir"],
    panels: [
      "paralama_diant_d",
      "porta_diant_d",
      "porta_tras_d",
      "porta_lateral_corredica",
      "retrovisor_d",
      "lateral_tras_d",
      "roda_diant_d",
      "roda_tras_d",
      "soleira_d",
      "coluna_a_d",
    ],
    view: "right",
  },
  {
    key: "lado_esquerdo",
    label: "Lado esquerdo",
    slots: ["lateral_esq"],
    panels: [
      "paralama_diant_e",
      "porta_diant_e",
      "porta_tras_e",
      "retrovisor_e",
      "lateral_tras_e",
      "roda_diant_e",
      "roda_tras_e",
      "soleira_e",
      "coluna_a_e",
    ],
    view: "left",
  },
  {
    key: "traseira",
    label: "Traseira",
    slots: ["traseira", "diag_tras"],
    panels: ["parachoque_tras", "tampa_tras", "cacamba", "vidro_tras", "lanterna_e", "lanterna_d"],
    view: "rear",
  },
  { key: "teto", label: "Teto", slots: [], panels: ["teto"], view: "top" },
  {
    key: "interior_itens",
    label: "Interior e itens",
    slots: ["painel", "chave", "motor", "step", "ferramentas", "combustivel"],
    panels: [],
    view: "free",
  },
  { key: "pertences", label: "Pertences do cliente", slots: [], panels: [], view: "free" },
];

const EXTERIOR_STOPS: ReadonlySet<StopKey> = new Set([
  "frente",
  "lado_direito",
  "lado_esquerdo",
  "traseira",
  "teto",
]);

export function canCompleteStop(
  stop: StopKey,
  s: { photoSlots: Set<string>; damageCount: number; noDamage: boolean },
): { ok: boolean; missing: string[] } {
  const slots = STOPS.find((x) => x.key === stop)?.slots ?? [];
  const missing = slots.filter((slot) => !s.photoSlots.has(slot));
  if (EXTERIOR_STOPS.has(stop) && s.damageCount === 0 && !s.noDamage) missing.push("dano_ou_sem_dano");
  return { ok: missing.length === 0, missing };
}
