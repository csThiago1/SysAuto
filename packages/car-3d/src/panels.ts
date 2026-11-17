// Espelho manual de backend/core/apps/service_orders/checklist_constants.py
// (como VALID_TRANSITIONS): mudou lá, muda aqui.

export const PANEL_KEYS = [
  "parachoque_diant",
  "parachoque_tras",
  "capo",
  "teto",
  "tampa_tras",
  "cacamba",
  "paralama_diant_e",
  "paralama_diant_d",
  "lateral_tras_e",
  "lateral_tras_d",
  "porta_diant_e",
  "porta_diant_d",
  "porta_tras_e",
  "porta_tras_d",
  "porta_lateral_corredica",
  "retrovisor_e",
  "retrovisor_d",
  "soleira_e",
  "soleira_d",
  "coluna_a_e",
  "coluna_a_d",
  "parabrisa",
  "vidro_tras",
  "farol_e",
  "farol_d",
  "lanterna_e",
  "lanterna_d",
  "grade",
  "roda_diant_e",
  "roda_diant_d",
  "roda_tras_e",
  "roda_tras_d",
] as const;

export type PanelKey = (typeof PANEL_KEYS)[number];

export const PANEL_LABELS: Record<PanelKey, string> = {
  parachoque_diant: "Para-choque dianteiro",
  parachoque_tras: "Para-choque traseiro",
  capo: "Capô",
  teto: "Teto",
  tampa_tras: "Tampa traseira",
  cacamba: "Caçamba",
  paralama_diant_e: "Para-lama dianteiro esquerdo",
  paralama_diant_d: "Para-lama dianteiro direito",
  lateral_tras_e: "Lateral traseira esquerda",
  lateral_tras_d: "Lateral traseira direita",
  porta_diant_e: "Porta dianteira esquerda",
  porta_diant_d: "Porta dianteira direita",
  porta_tras_e: "Porta traseira esquerda",
  porta_tras_d: "Porta traseira direita",
  porta_lateral_corredica: "Porta lateral corrediça",
  retrovisor_e: "Retrovisor esquerdo",
  retrovisor_d: "Retrovisor direito",
  soleira_e: "Soleira esquerda",
  soleira_d: "Soleira direita",
  coluna_a_e: "Coluna A esquerda",
  coluna_a_d: "Coluna A direita",
  parabrisa: "Para-brisa",
  vidro_tras: "Vidro traseiro",
  farol_e: "Farol esquerdo",
  farol_d: "Farol direito",
  lanterna_e: "Lanterna esquerda",
  lanterna_d: "Lanterna direita",
  grade: "Grade",
  roda_diant_e: "Roda dianteira esquerda",
  roda_diant_d: "Roda dianteira direita",
  roda_tras_e: "Roda traseira esquerda",
  roda_tras_d: "Roda traseira direita",
};

export const DAMAGE_TYPES = [
  { value: "amassado", label: "Amassado" },
  { value: "risco", label: "Risco" },
  { value: "trinca", label: "Trinca" },
  { value: "quebra", label: "Quebra" },
  { value: "corrosao", label: "Corrosão" },
  { value: "pintura", label: "Pintura" },
  { value: "faltando", label: "Faltando" },
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number]["value"];

export const SEVERITIES = [
  { value: "leve", label: "Leve" },
  { value: "moderada", label: "Moderada" },
  { value: "grave", label: "Grave" },
] as const;
export type Severity = (typeof SEVERITIES)[number]["value"];

export const RELATIONS = [
  { value: "sinistro", label: "Sinistro" },
  { value: "pre_existente", label: "Pré-existente" },
  { value: "nao_sei", label: "Não sei" },
] as const;
export type Relation = (typeof RELATIONS)[number]["value"];

export const SEVERITY_COLORS: Record<Severity, string> = {
  leve: "#ffe000",
  moderada: "#ff8a00",
  grave: "#ea0e03",
};

/** Lataria de carro sem cor conhecida (FANTASIA / NAO_INFORMADA). */
export const NEUTRAL_PAINT = "#9a9a9a";

export type BodyType = "hatch" | "sedan" | "suv" | "pickup" | "van";

export type CameraView = "free" | "front" | "rear" | "left" | "right" | "top" | "front34" | "rear34";
