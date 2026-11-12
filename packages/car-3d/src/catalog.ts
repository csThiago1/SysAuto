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

const DDIAZ = "Ddiaz Design";

/**
 * Catálogo de modelos 3D: os reais antes dos provisórios. A ordem importa no padrão da carroceria
 * (o primeiro `bodyDefault` permitido vence): Virtus (NC) antes do Onix (CC BY), para quem não pode NC
 * cair no Onix. Título, autor, licença e link vêm do `asset.extras` de cada .glb (Sketchfab).
 */
export const CAR_MODELS: CarModelEntry[] = [
  {
    key: "polo",
    title: "2024 Volkswagen Polo 170 TSI",
    file: "polo.glb",
    regionsFile: "polo.regions.json",
    bodyType: "hatch",
    families: [{ make: "volkswagen", family: "polo" }],
    bodyDefault: true,
    license: "CC-BY-NC-SA-4.0",
    author: DDIAZ,
    sourceUrl: "https://sketchfab.com/3d-models/2024-volkswagen-polo-170-tsi-ec0f4dfd1ca84a859725e4002e9cf120",
  },
  {
    key: "virtus",
    title: "2024 Volkswagen Virtus TSI",
    file: "virtus.glb",
    regionsFile: "virtus.regions.json",
    bodyType: "sedan",
    families: [{ make: "volkswagen", family: "virtus" }],
    bodyDefault: true,
    license: "CC-BY-NC-SA-4.0",
    author: DDIAZ,
    sourceUrl: "https://sketchfab.com/3d-models/2024-volkswagen-virtus-tsi-2678bb3bfbe1482cb6faa084674e100b",
  },
  {
    key: "onix",
    title: "chevrolet onix",
    file: "onix.glb",
    regionsFile: "onix.regions.json",
    bodyType: "sedan", // é o Onix Plus
    families: [
      { make: "chevrolet", family: "onix" },
      { make: "chevrolet", family: "onix_plus" },
    ],
    bodyDefault: true,
    license: "CC-BY-4.0",
    author: "uzb_rx7",
    sourceUrl: "https://sketchfab.com/3d-models/chevrolet-onix-bfd798c2695847b28ab681d42abc7056",
  },
  {
    key: "spark_euv",
    title: "2026 Chevrolet Spark EUV",
    file: "spark_euv.glb",
    regionsFile: "spark_euv.regions.json",
    bodyType: "suv",
    families: [{ make: "chevrolet", family: "spark_euv" }],
    bodyDefault: false,
    license: "CC-BY-NC-SA-4.0",
    author: DDIAZ,
    sourceUrl: "https://sketchfab.com/3d-models/2026-chevrolet-spark-euv-620ce2baa45d466ca599412c3b843efc",
  },
  ...Object.values(PLACEHOLDERS),
];

export const LICENSE_LABELS: Record<Exclude<ModelLicense, "PLACEHOLDER">, string> = {
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
