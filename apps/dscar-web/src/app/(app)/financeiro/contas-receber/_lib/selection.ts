import type { ReceivableDocumentListItem } from "@paddock/types";

/** id do título → saldo dele. Guardar o saldo deixa somar o que saiu da tela por busca ou filtro. */
export type Selection = Record<string, string>;

type Doc = Pick<ReceivableDocumentListItem, "id" | "status" | "amount_remaining">;

export function hasBalance(doc: Doc): boolean {
  return (
    (doc.status === "open" || doc.status === "partial" || doc.status === "overdue") &&
    Number(doc.amount_remaining) > 0
  );
}

export function toggle(selection: Selection, doc: Doc): Selection {
  const next = { ...selection };
  if (doc.id in next) delete next[doc.id];
  else next[doc.id] = doc.amount_remaining;
  return next;
}

/** Estado da caixa do cabeçalho, contando só os títulos com saldo que estão na tela. */
export function headerState(selection: Selection, visible: Doc[]): boolean | "indeterminate" {
  const selectable = visible.filter(hasBalance);
  const marked = selectable.filter((d) => d.id in selection).length;
  if (marked === 0) return false;
  return marked === selectable.length ? true : "indeterminate";
}

/** Marca todos os visíveis com saldo; se já estão todos marcados, desmarca só eles. */
export function toggleAll(selection: Selection, visible: Doc[]): Selection {
  const selectable = visible.filter(hasBalance);
  const allMarked = selectable.every((d) => d.id in selection);
  const next = { ...selection };
  for (const d of selectable) {
    if (allMarked) delete next[d.id];
    else next[d.id] = d.amount_remaining;
  }
  return next;
}

/**
 * Lista recarregou: sai quem ficou sem saldo e o saldo guardado acompanha o novo.
 * Quem não veio na lista (está fora da busca ou do filtro atual) continua selecionado.
 */
export function reconcile(selection: Selection, loaded: Doc[], goneIds: string[] = []): Selection {
  let next = selection;
  // goneIds: vieram na carga anterior do MESMO filtro e sumiram (baixa, cancelamento): saem também
  for (const id of goneIds) {
    if (!(id in selection)) continue;
    if (next === selection) next = { ...selection };
    delete next[id];
  }
  for (const doc of loaded) {
    if (!(doc.id in selection)) continue;
    const balance = hasBalance(doc) ? doc.amount_remaining : undefined;
    if (balance === selection[doc.id]) continue;
    // só copia se algo mudou: devolver o mesmo objeto evita render à toa
    if (next === selection) next = { ...selection };
    if (balance === undefined) delete next[doc.id];
    else next[doc.id] = balance;
  }
  return next;
}

export function total(selection: Selection): number {
  // em centavos: somar reais em ponto flutuante erra (0.1 + 0.2)
  const cents = Object.values(selection).reduce((sum, v) => sum + Math.round(Number(v) * 100), 0);
  return cents / 100;
}
