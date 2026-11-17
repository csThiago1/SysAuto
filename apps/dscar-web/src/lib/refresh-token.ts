/**
 * Renovação do access token no backend (/api/v1/auth/refresh/).
 *
 * - O campo é `refresh_token` (era `refresh`: toda renovação voltava 400 e a
 *   sessão caía quando o access de 15 min vencia).
 * - O backend ROTACIONA o refresh token: duas chamadas com o mesmo token, só a
 *   primeira passa. Aqui cada token é renovado uma vez só por instância; quem
 *   chegar junto (ou logo depois) recebe o mesmo par novo.
 */

export type TokenPair = { access: string; refresh: string }

/** Falha passageira (rede, 5xx): não é motivo para deslogar, tenta de novo depois. */
export class RefreshTransitorio extends Error {}

const emAndamento = new Map<string, Promise<TokenPair | null>>()
/** Quanto tempo o resultado fica disponível para chamadas atrasadas com o token antigo. */
const JANELA_MS = 30_000

/**
 * Devolve o par novo, `null` quando o backend recusa o token (400/401 → login de novo)
 * ou lança `RefreshTransitorio` quando a falha é de rede/servidor.
 */
export function refreshAccessToken(
  backendUrl: string,
  refreshToken: string
): Promise<TokenPair | null> {
  const atual = emAndamento.get(refreshToken)
  if (atual) return atual

  const promessa = (async (): Promise<TokenPair | null> => {
    let res: Response
    try {
      res = await fetch(`${backendUrl}/api/v1/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: AbortSignal.timeout(8_000),
      })
    } catch {
      throw new RefreshTransitorio("refresh_rede")
    }
    if (res.status === 400 || res.status === 401) return null
    if (!res.ok) throw new RefreshTransitorio(`refresh_${res.status}`)
    const data = (await res.json().catch(() => ({}))) as Partial<TokenPair>
    if (!data.access || !data.refresh) throw new RefreshTransitorio("refresh_resposta")
    return { access: data.access, refresh: data.refresh }
  })()

  emAndamento.set(refreshToken, promessa)
  promessa.then(
    // resultado (par novo ou recusa) fica para quem chegar atrasado com o mesmo token
    () => setTimeout(() => emAndamento.delete(refreshToken), JANELA_MS),
    // falha passageira não fica em cache: a próxima chamada tenta de verdade
    () => emAndamento.delete(refreshToken)
  )
  return promessa
}
