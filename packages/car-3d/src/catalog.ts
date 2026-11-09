import type { BodyType } from "./panels";

export type ModelLicense = "CC0" | "CC-BY-4.0" | "CC-BY-NC-SA-4.0" | "PLACEHOLDER";

export type CarModelEntry = {
  key: string;
  title: string;
  file: string;
  regionsFile: string;
  bodyType: BodyType;
  /** make/family em slug, como vehicle_make/vehicle_family do estado do checklist. */
  families: { make: string; family: string }[];
  bodyDefault: boolean;
  license: ModelLicense;
  author: string;
  sourceUrl: string;
};

const placeholder = (bodyType: BodyType, title: string): CarModelEntry => ({
  key: `placeholder_${bodyType}`,
  title,
  file: `placeholder-${bodyType}.glb`,
  regionsFile: `placeholder-${bodyType}.regions.json`,
  bodyType,
  families: [],
  bodyDefault: false,
  license: "PLACEHOLDER",
  author: "",
  sourceUrl: "",
});

const PLACEHOLDERS: Record<BodyType, CarModelEntry> = {
  hatch: placeholder("hatch", "Hatch (provisório)"),
  sedan: placeholder("sedan", "Sedã (provisório)"),
  suv: placeholder("suv", "SUV (provisório)"),
  pickup: placeholder("pickup", "Picape (provisório)"),
  van: placeholder("van", "Van (provisório)"),
};

/** Catálogo de modelos 3D. A Task 14 acrescenta os reais antes dos provisórios. */
export const CAR_MODELS: CarModelEntry[] = Object.values(PLACEHOLDERS);

const LICENSE_LABELS: Record<Exclude<ModelLicense, "PLACEHOLDER">, string> = {
  CC0: "CC0 1.0",
  "CC-BY-4.0": "CC BY 4.0",
  "CC-BY-NC-SA-4.0": "CC BY-NC-SA 4.0",
};

/** Família → padrão da carroceria → provisório, pulando NC quando o tenant não pode. */
export function resolveCarModel(
  q: { make: string | null; family: string | null; bodyType: BodyType; allowNc: boolean },
  catalog: CarModelEntry[] = CAR_MODELS,
): CarModelEntry {
  const allowed = catalog.filter((e) => q.allowNc || e.license !== "CC-BY-NC-SA-4.0");
  const byFamily = allowed.find((e) => e.families.some((f) => f.make === q.make && f.family === q.family));
  return (
    byFamily ??
    allowed.find((e) => e.bodyDefault && e.bodyType === q.bodyType) ??
    PLACEHOLDERS[q.bodyType]
  );
}

export function creditLine(e: CarModelEntry): string | null {
  if (e.license === "PLACEHOLDER") return null;
  return `${e.title} · ${e.author} · ${LICENSE_LABELS[e.license]}`;
}
