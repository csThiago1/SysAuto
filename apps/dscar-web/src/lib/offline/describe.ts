import type { DraftMutation } from "./db";

const RULES: Array<[RegExp, string]> = [
  [/\/photos\/$/, "Foto"],
  [/\/signatures\/capture\/$/, "Assinatura"],
  [/\/apontamentos\/$/, "Apontamento de horas"],
  [/\/parts(\/|$)/, "Peça"],
  [/\/labor\/$/, "Serviço"],
  [/\/transition\/$/, "Transição de status"],
  [/\/checklist-items\/bulk\/$/, "Checklist"],
  [/\/service-orders\/$/, "Nova OS"],
  [/\/service-orders\/[0-9a-f-]+\/$/, "Edição de OS"],
];

/** Rótulo PT-BR de um draft pra exibição em banner/modal. */
export function describeDraft(d: DraftMutation): string {
  for (const [re, label] of RULES) {
    if (re.test(d.url)) return label;
  }
  return `${d.method} ${d.url}`;
}
