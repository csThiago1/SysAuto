/**
 * Extrai sinistro, orçamento e versão do e-mail de conclusão do Cilia.
 *
 * O Cilia manda um e-mail a cada análise, e o assunto já traz tudo que a API
 * de importação precisa — o sufixo do orçamento é a versão:
 *
 *   "Yelum Seguradora - Sin. 22575391 - Orç. 905433.2 - Conclusão: Autorizado"
 *                            └ sinistro    └ orçamento └ versão
 *
 * Também aceita o texto do corpo do e-mail, que usa os rótulos por extenso
 * ("Sinistro 22575391 - Número do Orçamento 905433.2"), porque na prática as
 * pessoas copiam tanto de um lugar quanto do outro.
 */

export interface CiliaSubject {
  casualtyNumber: string
  budgetNumber: string
  /** Ausente quando o assunto não traz sufixo de versão. */
  versionNumber?: string
  /** Só informativo — a API não usa. */
  conclusion?: string
}

// Sinistro aceita ponto: existem números como "13147.26.2".
const SUBJECT_RE =
  /Sin(?:istro)?\.?\s*([\w.]+)\s*-\s*(?:N[úu]mero\s+do\s+)?Or[çc](?:amento)?\.?\s*(\d+)(?:\.(\d+))?/i

const CONCLUSION_RE = /Conclus[ãa]o:\s*([^\n\r]+?)\s*$/i

/**
 * @param raw Assunto ou trecho do e-mail do Cilia.
 * @returns Os campos encontrados, ou null se o texto não for reconhecido.
 */
export function parseCiliaSubject(raw: string): CiliaSubject | null {
  const text = raw.trim()
  if (!text) return null

  const match = text.match(SUBJECT_RE)
  if (!match) return null

  const [, casualtyNumber, budgetNumber, versionNumber] = match

  const result: CiliaSubject = { casualtyNumber, budgetNumber }
  if (versionNumber) result.versionNumber = versionNumber

  const conclusion = text.match(CONCLUSION_RE)?.[1]
  if (conclusion) result.conclusion = conclusion

  return result
}
