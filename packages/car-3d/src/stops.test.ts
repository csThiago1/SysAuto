import { describe, expect, it } from "vitest";
import { PANEL_KEYS } from "./panels";
import { canCompleteStop, STOPS } from "./stops";

describe("STOPS", () => {
  it("7 paradas na ordem do spec", () => {
    expect(STOPS.map((s) => s.key)).toEqual([
      "frente",
      "lado_direito",
      "lado_esquerdo",
      "traseira",
      "teto",
      "interior_itens",
      "pertences",
    ]);
  });

  it("os 12 slots obrigatórios estão distribuídos pelas paradas", () => {
    expect(STOPS.flatMap((s) => s.slots)).toHaveLength(12);
  });

  it("toda peça pertence a exatamente uma parada", () => {
    const all = STOPS.flatMap((s) => s.panels);
    expect([...all].sort()).toEqual([...PANEL_KEYS].sort());
  });
});

describe("canCompleteStop", () => {
  it("falta slot obrigatório", () => {
    expect(
      canCompleteStop("frente", { photoSlots: new Set(["frente"]), damageCount: 0, noDamage: true }),
    ).toEqual({ ok: false, missing: ["diag_diant"] });
  });

  it("slots completos + sem dano", () => {
    expect(
      canCompleteStop("frente", {
        photoSlots: new Set(["frente", "diag_diant"]),
        damageCount: 0,
        noDamage: true,
      }).ok,
    ).toBe(true);
  });

  it("parada externa exige dano ou 'sem dano aqui'", () => {
    expect(
      canCompleteStop("teto", { photoSlots: new Set(), damageCount: 0, noDamage: false }),
    ).toEqual({ ok: false, missing: ["dano_ou_sem_dano"] });
    expect(
      canCompleteStop("teto", { photoSlots: new Set(), damageCount: 1, noDamage: false }).ok,
    ).toBe(true);
  });

  it("parada interna não exige dano", () => {
    expect(
      canCompleteStop("pertences", { photoSlots: new Set(), damageCount: 0, noDamage: false }).ok,
    ).toBe(true);
  });
});
