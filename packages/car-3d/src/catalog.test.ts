import { describe, expect, it } from "vitest";
import { CAR_MODELS, creditLine, resolveCarModel, type CarModelEntry } from "./catalog";

const entry = (over: Partial<CarModelEntry>): CarModelEntry => ({
  key: "x",
  title: "X",
  file: "x.glb",
  regionsFile: "x.regions.json",
  bodyType: "hatch",
  families: [],
  bodyDefault: false,
  license: "CC-BY-4.0",
  author: "Autor",
  sourceUrl: "https://example.com",
  ...over,
});

const onix = entry({ key: "onix", title: "Onix", families: [{ make: "chevrolet", family: "onix" }] });
const polo = entry({
  key: "polo",
  title: "Polo",
  author: "Ddiaz Design",
  license: "CC-BY-NC-SA-4.0",
  families: [{ make: "volkswagen", family: "polo" }],
});
const hatchDefault = entry({ key: "hatch_real", title: "Hatch", bodyDefault: true, license: "CC0" });
const catalog = [onix, polo, hatchDefault, ...CAR_MODELS];

describe("resolveCarModel", () => {
  it("família casada com licença permitida", () => {
    expect(
      resolveCarModel({ make: "chevrolet", family: "onix", bodyType: "hatch", allowNc: false }, catalog),
    ).toBe(onix);
  });

  it("família NC sem allowNc cai no padrão da carroceria", () => {
    expect(
      resolveCarModel({ make: "volkswagen", family: "polo", bodyType: "hatch", allowNc: false }, catalog),
    ).toBe(hatchDefault);
  });

  it("família NC com allowNc usa o modelo da família", () => {
    expect(
      resolveCarModel({ make: "volkswagen", family: "polo", bodyType: "hatch", allowNc: true }, catalog),
    ).toBe(polo);
  });

  it("sem família: padrão da carroceria", () => {
    expect(resolveCarModel({ make: null, family: null, bodyType: "hatch", allowNc: true }, catalog)).toBe(
      hatchDefault,
    );
  });

  it("carroceria sem padrão real: provisório", () => {
    const m = resolveCarModel({ make: null, family: null, bodyType: "van", allowNc: true }, catalog);
    expect(m.license).toBe("PLACEHOLDER");
    expect(m.bodyType).toBe("van");
  });
});

describe("CAR_MODELS", () => {
  it("tem um provisório por carroceria, no fim da lista", () => {
    const placeholders = CAR_MODELS.filter((m) => m.license === "PLACEHOLDER");
    expect(placeholders.map((m) => m.bodyType).sort()).toEqual(["hatch", "pickup", "sedan", "suv", "van"]);
    expect(CAR_MODELS.slice(-placeholders.length)).toEqual(placeholders);
  });
});

describe("creditLine", () => {
  it("entrada NC", () => {
    expect(creditLine(polo)).toBe("Polo · Ddiaz Design · CC BY-NC-SA 4.0");
  });

  it("provisório não tem crédito", () => {
    expect(creditLine(CAR_MODELS[CAR_MODELS.length - 1])).toBeNull();
  });
});
