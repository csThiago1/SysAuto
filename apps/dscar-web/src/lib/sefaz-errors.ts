/**
 * Orientação para erros SEFAZ/Focus conhecidos.
 * Mapeia códigos de rejeição frequentes da DS Car para instruções acionáveis.
 */

interface SefazHint {
  pattern: RegExp
  hint: string
}

const HINTS: SefazHint[] = [
  {
    pattern: /\b481\b|regime tributari/i,
    hint: "Regime tributário divergente do cadastro SEFAZ. Confira o campo regime_tributario no emissor fiscal (DS Car: 3 = Regime Normal).",
  },
  {
    pattern: /\b980\b|razao social|razão social/i,
    hint: 'Razão social diverge do cadastro SEFAZ. Deve ser EXATA: "D S CAR CENTRO AUTOMOTIVO LTDA" (com espaço em "D S").',
  },
  {
    pattern: /\b629\b|valor do produto|valor bruto/i,
    hint: "Valor do produto diverge: o valor bruto deve ser quantidade × preço unitário SEM desconto. Confira preço e desconto das peças na OS.",
  },
  {
    pattern: /\b212\b|data.*emiss/i,
    hint: "Data de emissão inválida — problema de fuso horário. A emissão usa America/Manaus; reemita o documento.",
  },
  {
    pattern: /ncm/i,
    hint: "NCM inválido ou ausente em alguma peça. Corrija o NCM (8 dígitos) na aba de peças da OS e reemita.",
  },
  {
    pattern: /inscri[cç][aã]o estadual|\bIE\b/i,
    hint: "Inscrição estadual inválida ou ausente. Confira a IE do emissor (042906105) ou do destinatário.",
  },
  {
    pattern: /c[oó]digo.*munic[ií]pio|ibge/i,
    hint: "Código IBGE do município ausente ou inválido no endereço do cliente. Corrija no cadastro (Manaus: 1302603).",
  },
]

/** Retorna orientação acionável para a mensagem SEFAZ, ou null se desconhecida. */
export function explainSefazError(mensagem: string | null | undefined): string | null {
  if (!mensagem) return null
  const match = HINTS.find((h) => h.pattern.test(mensagem))
  return match?.hint ?? null
}
