import { signOut } from "next-auth/react"

/** Nome do cache de GETs da API no service worker (sw/service-worker.ts). */
export const API_CACHE = "api-get-cache"

/**
 * Logout que também apaga as respostas da API guardadas pelo PWA: num celular
 * compartilhado, o próximo usuário não pode ver dados (com PII) de quem saiu.
 */
export async function sair(): Promise<void> {
  try {
    await caches.delete(API_CACHE)
  } catch {
    // sem Cache Storage (navegador antigo / contexto inseguro): nada a apagar
  }
  await signOut({ callbackUrl: "/login" })
}
