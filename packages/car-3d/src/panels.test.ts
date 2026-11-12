import { describe, expect, it } from "vitest";
import { PANEL_KEYS, PANEL_LABELS, SEVERITY_COLORS } from "./panels";

describe("panels", () => {
  it("tem as 32 chaves da Task 2, na ordem", () => {
    expect(PANEL_KEYS.length).toBe(32);
    expect(PANEL_KEYS[0]).toBe("parachoque_diant");
    expect(PANEL_KEYS[31]).toBe("roda_tras_d");
    expect(Object.keys(PANEL_LABELS).sort()).toEqual([...PANEL_KEYS].sort());
  });

  it("cores de gravidade", () => {
    expect(SEVERITY_COLORS).toEqual({ leve: "#ffe000", moderada: "#ff8a00", grave: "#ea0e03" });
  });
});
