import { describe, expect, it } from "vitest";
import { NAV_SECTIONS } from "./nav-config";
import {
  areaHome,
  areaOfPath,
  defaultAreaForRole,
  isAreaId,
  sectionsForArea,
  visibleAreas,
} from "./areas";

describe("areaOfPath", () => {
  it("mapeia rotas de uma área só", () => {
    expect(areaOfPath("/os/kanban")).toBe("oficina");
    expect(areaOfPath("/os")).toBe("oficina");
    expect(areaOfPath("/os/nova")).toBe("oficina");
    expect(areaOfPath("/estoque/produtos/pecas")).toBe("oficina");
    expect(areaOfPath("/crm/regras")).toBe("comercial");
    expect(areaOfPath("/orcamentos-particulares/12")).toBe("comercial");
    expect(areaOfPath("/orcamentos")).toBe("oficina");
    expect(areaOfPath("/fiscal/resumo")).toBe("financeiro");
    expect(areaOfPath("/configuracoes/permissoes")).toBe("gestao");
  });
  it("rota compartilhada ou desconhecida devolve null", () => {
    expect(areaOfPath("/os/123")).toBeNull();
    expect(areaOfPath("/os/123/vistoria")).toBeNull();
    expect(areaOfPath("/cadastros/42")).toBeNull();
    expect(areaOfPath("/veiculos")).toBeNull();
    expect(areaOfPath("/")).toBeNull();
    expect(areaOfPath("/sobre")).toBeNull();
  });
  it("não confunde prefixo parcial", () => {
    expect(areaOfPath("/osx")).toBeNull();
    expect(areaOfPath("/financeiro-x")).toBeNull();
  });
});

describe("áreas e papéis", () => {
  it("área padrão do papel", () => {
    expect(defaultAreaForRole("OWNER")).toBe("gestao");
    expect(defaultAreaForRole("ADMIN")).toBe("gestao");
    expect(defaultAreaForRole("CONSULTANT")).toBe("oficina");
    expect(defaultAreaForRole(undefined)).toBe("oficina");
    expect(areaHome(defaultAreaForRole("OWNER"))).toBe("/dashboard");
  });
  it("STOREKEEPER não vê a área Financeiro", () => {
    expect(visibleAreas("STOREKEEPER", [])).not.toContain("financeiro");
    expect(visibleAreas("OWNER", [])).toEqual(["oficina", "comercial", "financeiro", "gestao"]);
  });
  it("sectionsForArea só traz itens da área", () => {
    const ids = sectionsForArea("OWNER", [], "comercial").flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toEqual(["orcamentos-particulares", "crm"]);
  });
  it("todo href do menu cai na área do item ou numa rota compartilhada", () => {
    for (const s of NAV_SECTIONS) for (const item of s.items) {
      const hrefs = [item.href, ...(item.children ?? []).map((c) => c.href)].filter(Boolean) as string[];
      for (const h of hrefs) expect([item.area, null]).toContain(areaOfPath(h.split("?")[0]!));
    }
  });
  it("isAreaId rejeita lixo", () => {
    expect(isAreaId("comercial")).toBe(true);
    expect(isAreaId("xyz")).toBe(false);
    expect(isAreaId(null)).toBe(false);
  });
});
