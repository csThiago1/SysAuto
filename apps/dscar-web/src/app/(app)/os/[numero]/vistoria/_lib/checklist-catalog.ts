/** Catálogo client-side dos itens de checklist de vistoria.
 *  O backend não tem catálogo — item_key é livre; este é o padrão da oficina. */

export type ChecklistStatus = "ok" | "attention" | "critical" | "pending";

export interface CatalogItem {
  category: string;
  itemKey: string;
  label: string;
}

export interface ServerChecklistItem {
  checklist_type: string;
  category: string;
  item_key: string;
  status: ChecklistStatus;
  notes?: string;
}

export const CHECKLIST_CATALOG: CatalogItem[] = [
  { category: "bodywork", itemKey: "arranhoes", label: "Arranhões" },
  { category: "bodywork", itemKey: "amassados", label: "Amassados" },
  { category: "glass", itemKey: "parabrisa", label: "Para-brisa" },
  { category: "glass", itemKey: "retrovisores", label: "Retrovisores" },
  { category: "lighting", itemKey: "farois", label: "Faróis" },
  { category: "lighting", itemKey: "lanternas", label: "Lanternas" },
  { category: "tires", itemKey: "pneus", label: "Pneus" },
  { category: "tires", itemKey: "rodas_calotas", label: "Rodas / Calotas" },
  { category: "accessories", itemKey: "estepe", label: "Estepe" },
  { category: "accessories", itemKey: "macaco_chave", label: "Macaco / Chave de roda" },
  { category: "accessories", itemKey: "triangulo", label: "Triângulo" },
  { category: "accessories", itemKey: "som_multimidia", label: "Som / Multimídia" },
  { category: "interior", itemKey: "bancos", label: "Bancos" },
  { category: "interior", itemKey: "painel", label: "Painel" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  bodywork: "Lataria / Pintura",
  glass: "Vidros",
  lighting: "Iluminação",
  tires: "Pneus",
  interior: "Interior",
  accessories: "Acessórios",
  mechanical: "Mecânico Visual",
};

/** Mescla catálogo com o estado salvo no servidor (itens fora do catálogo entram no fim). */
export function mergeChecklist(
  serverItems: ServerChecklistItem[],
  checklistType: string
): Array<CatalogItem & { status: ChecklistStatus }> {
  const byKey = new Map(
    serverItems
      .filter((i) => i.checklist_type === checklistType)
      .map((i) => [`${i.category}:${i.item_key}`, i])
  );
  const merged = CHECKLIST_CATALOG.map((c) => ({
    ...c,
    status: byKey.get(`${c.category}:${c.itemKey}`)?.status ?? ("pending" as const),
  }));
  const catalogKeys = new Set(CHECKLIST_CATALOG.map((c) => `${c.category}:${c.itemKey}`));
  for (const item of serverItems) {
    if (item.checklist_type !== checklistType) continue;
    const key = `${item.category}:${item.item_key}`;
    if (!catalogKeys.has(key)) {
      merged.push({
        category: item.category,
        itemKey: item.item_key,
        label: item.item_key,
        status: item.status,
      });
    }
  }
  return merged;
}

/** Conta itens já avaliados (status != pending). */
export function countDone(items: Array<{ status: ChecklistStatus }>): number {
  return items.filter((i) => i.status !== "pending").length;
}
