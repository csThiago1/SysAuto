import { describe, expect, it } from "vitest";
import { NAV_SECTIONS, visibleModules, visibleSections } from "./nav-config";

describe("visibleModules", () => {
  it("OWNER vê todos os módulos de todas as seções", () => {
    const mods = visibleModules("OWNER", []);
    const total = NAV_SECTIONS.reduce((n, s) => n + s.items.length, 0);
    expect(mods).toHaveLength(total);
    expect(mods[0]?.id).toBe("dashboard");
  });

  it("STOREKEEPER não vê FINANCEIRO, FISCAL nem RH", () => {
    const sections = visibleSections("STOREKEEPER", []);
    const labels = sections.map((s) => s.label);
    expect(labels).not.toContain("FINANCEIRO");
    expect(labels).not.toContain("FISCAL");
    expect(labels).not.toContain("RH");
    expect(labels).toContain("ESTOQUE");
  });

  it("CONSULTANT com can_view_financial vê FINANCEIRO", () => {
    const labels = visibleSections("CONSULTANT", ["can_view_financial"]).map((s) => s.label);
    expect(labels).toContain("FINANCEIRO");
  });

  it("CONSULTANT sem permissão não vê FINANCEIRO", () => {
    const labels = visibleSections("CONSULTANT", []).map((s) => s.label);
    expect(labels).not.toContain("FINANCEIRO");
  });

  it("MANAGER vê FINANCEIRO sem permissão explícita", () => {
    const labels = visibleSections("MANAGER", []).map((s) => s.label);
    expect(labels).toContain("FINANCEIRO");
  });
});
