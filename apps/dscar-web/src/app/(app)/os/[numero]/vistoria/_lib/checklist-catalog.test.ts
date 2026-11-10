import { describe, expect, it } from "vitest";
import {
  CHECKLIST_CATALOG,
  catalogFor,
  countDone,
  mergeChecklist,
  type ServerChecklistItem,
} from "./checklist-catalog";

describe("catalogFor", () => {
  it("entrada omite lataria, vidros e iluminação (marcados no 3D)", () => {
    const categories = new Set(catalogFor("entrada").map((i) => i.category));
    expect(categories.has("bodywork")).toBe(false);
    expect(categories.has("glass")).toBe(false);
    expect(categories.has("lighting")).toBe(false);
    expect(categories.has("tires")).toBe(true);
  });

  it("saída mantém o catálogo inteiro", () => {
    expect(catalogFor("saida")).toEqual(CHECKLIST_CATALOG);
  });
});

describe("mergeChecklist", () => {
  it("retorna catálogo completo como pending sem dados do servidor", () => {
    const merged = mergeChecklist([], "saida");
    expect(merged).toHaveLength(CHECKLIST_CATALOG.length);
    expect(merged.every((i) => i.status === "pending")).toBe(true);
  });

  it("aplica status salvo e ignora itens de outro checklist_type", () => {
    const server: ServerChecklistItem[] = [
      { checklist_type: "entrada", category: "tires", item_key: "pneus", status: "ok" },
      { checklist_type: "saida", category: "tires", item_key: "pneus", status: "critical" },
    ];
    const merged = mergeChecklist(server, "entrada");
    const pneus = merged.find((i) => i.itemKey === "pneus");
    expect(pneus?.status).toBe("ok");
  });

  it("inclui itens fora do catálogo no fim", () => {
    const server: ServerChecklistItem[] = [
      { checklist_type: "entrada", category: "mechanical", item_key: "bateria", status: "attention" },
    ];
    const merged = mergeChecklist(server, "entrada");
    expect(merged).toHaveLength(catalogFor("entrada").length + 1);
    expect(merged.at(-1)?.itemKey).toBe("bateria");
  });
});

describe("countDone", () => {
  it("conta apenas não-pendentes", () => {
    expect(
      countDone([{ status: "ok" }, { status: "pending" }, { status: "critical" }])
    ).toBe(2);
  });
});
