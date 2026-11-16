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

const emAndamento = new Map<string, Promise<TokenPair | null>>()
/** Quanto tempo o resultado fica disponível para chamadas atrasadas com o token antigo. */
const JANELA_MS = 30_000

export function refreshAccessToken(
  backendUrl: string,
  refreshToken: string
): Promise<TokenPair | null> {
  const atual = emAndamento.get(refreshToken)
  if (atual) return atual

  const promessa = (async (): Promise<TokenPair | null> => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as Partial<TokenPair>
      return data.access && data.refresh ? { access: data.access, refresh: data.refresh } : null
    } catch {
      return null
    }
  })()

  emAndamento.set(refreshToken, promessa)
  void promessa.finally(() => {
    setTimeout(() => emAndamento.delete(refreshToken), JANELA_MS)
  })
  return promessa
}
