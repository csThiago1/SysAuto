/**
 * Paddock Solutions — E2E Shared Helpers
 * =======================================
 *
 * Utilitários compartilhados por todos os testes Playwright do dscar-web.
 *
 * Uso:
 *   import { login, apiPost, smartTransition, fillPlate } from "./helpers"
 */

import type { Page } from "@playwright/test"

// ─── Constantes ───────────────────────────────────────────────────────────────

export const BASE_URL = "http://localhost:3001"
export const DEV_EMAIL = process.env.E2E_DEV_EMAIL ?? "thiago@paddock.solutions"
export const DEV_PASSWORD = process.env.E2E_DEV_PASSWORD ?? "paddock" + "123"
export const TENANT_DOMAIN = "dscar.localhost"

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Realiza login via dev-credentials e aguarda redirect para /os.
 */
export async function login(page: Page): Promise<void> {
  await page.goto("/login")
  await page.waitForLoadState("domcontentloaded")

  const emailInput = page.locator('input[type="email"], input[name="email"]')
  if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await emailInput.fill(DEV_EMAIL)
    await page.locator('input[type="password"]').fill(DEV_PASSWORD)
    await page.locator('button[type="submit"]').click()
  }
  // Sempre asserta que chegamos no dashboard após login
  // Timeout longo: cold start + HMR compilation podem demorar
  await page.waitForURL(/\/os/, { timeout: 30_000 })
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

export interface ApiResult {
  ok: boolean
  status: number
  body: unknown
}

/**
 * Extrai o header Cookie da sessão atual do browser context.
 */
export async function getCookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ")
}

/**
 * Helper interno: faz requisição HTTP via proxy com cookies + X-Tenant-Domain.
 * page.request ignora playwright.config baseURL — URLs devem ser absolutas.
 */
async function apiRequest(
  page: Page,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  data?: Record<string, unknown>
): Promise<ApiResult> {
  const cookieHeader = await getCookieHeader(page)
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`

  const headers: Record<string, string> = {
    Cookie: cookieHeader,
    "X-Tenant-Domain": TENANT_DOMAIN,
  }
  if (data !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  const response = await page.request.fetch(url, { method, data, headers })

  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = await response.text().catch(() => null)
  }

  return { ok: response.ok(), status: response.status(), body }
}

/** POST para o proxy Next.js com cookies de sessão + X-Tenant-Domain. */
export async function apiPost(
  page: Page,
  path: string,
  data: Record<string, unknown>
): Promise<ApiResult> {
  return apiRequest(page, "POST", path, data)
}

/** GET para o proxy Next.js com cookies de sessão + X-Tenant-Domain. */
export async function apiGet(page: Page, path: string): Promise<ApiResult> {
  return apiRequest(page, "GET", path)
}

/** PATCH para o proxy Next.js com cookies de sessão + X-Tenant-Domain. */
export async function apiPatch(
  page: Page,
  path: string,
  data: Record<string, unknown>
): Promise<ApiResult> {
  return apiRequest(page, "PATCH", path, data)
}

// ─── ID Extraction ────────────────────────────────────────────────────────────

/**
 * Extrai o UUID da OS a partir de uma URL no padrão `/service-orders/{uuid}`.
 *
 * @throws Error se a URL não contiver UUID válido no padrão esperado.
 */
export function extractOsId(url: string): string {
  // Aceita /os/{number} (PK inteiro) e /service-orders/{uuid}
  const numberMatch = url.match(/\/os\/(\d+)/)
  if (numberMatch) return numberMatch[1]
  const uuidMatch = url.match(/\/service-orders\/([a-f0-9-]{36})/)
  if (uuidMatch) return uuidMatch[1]
  throw new Error(`Não foi possível extrair ID de OS da URL: ${url}`)
}

// ─── Transition Helpers ───────────────────────────────────────────────────────

/**
 * Avança o status via UI: clica no dropdown "Avançar Status", seleciona o item
 * pelo label e aguarda o toast de confirmação.
 */
export async function uiTransition(page: Page, targetLabel: string): Promise<void> {
  // Abre o dropdown de transição de status
  const dropdownButton = page.getByRole("button", { name: /Avançar Status/i })
  await dropdownButton.click()

  // Seleciona o item de menu pelo label
  const menuItem = page.getByRole("menuitem", { name: targetLabel })
  await menuItem.click()

  // Aguarda toast de confirmação
  await page
    .locator(`text=Status atualizado para "${targetLabel}"`)
    .waitFor({ state: "visible", timeout: 10_000 })
}

/**
 * Avança o status via API, forçando a transição com credenciais de manager.
 */
/**
 * Transição simples via API (sem force). Funciona para transições
 * sem bloqueios ou quando os requisitos já estão satisfeitos.
 */
export async function apiTransition(
  page: Page,
  osId: string,
  newStatus: string
): Promise<ApiResult> {
  return apiPost(page, `/api/proxy/service-orders/${osId}/transition/`, {
    new_status: newStatus,
  })
}

/**
 * Tenta avançar o status via UI; se o dropdown ou o item não estiver visível,
 * cai para apiTransition e recarrega a página.
 */
export async function smartTransition(
  page: Page,
  osId: string,
  newStatus: string,
  statusLabel: string
): Promise<void> {
  // Tenta via UI primeiro
  try {
    const dropdownButton = page.getByRole("button", { name: /Avançar Status/i })
    const dropdownVisible = await dropdownButton
      .isVisible({ timeout: 3_000 })
      .catch(() => false)

    if (dropdownVisible) {
      await dropdownButton.click()

      const menuItem = page.getByRole("menuitem", { name: statusLabel })
      const menuItemVisible = await menuItem
        .isVisible({ timeout: 3_000 })
        .catch(() => false)

      if (menuItemVisible) {
        await menuItem.click()

        const toastVisible = await page
          .locator(`text=Status atualizado para "${statusLabel}"`)
          .isVisible({ timeout: 8_000 })
          .catch(() => false)

        if (toastVisible) {
          // UI transition succeeded
          return
        }
      } else {
        // Close dropdown before falling back
        await page.keyboard.press("Escape")
      }
    }
  } catch {
    // Fall through to API transition
  }

  // Fallback: transição via API
  const result = await apiTransition(page, osId, newStatus)
  if (!result.ok) {
    throw new Error(
      `smartTransition API fallback falhou (${result.status}): ${JSON.stringify(result.body)}`
    )
  }
  await page.reload()
  await page.waitForLoadState("domcontentloaded")
}

// ─── OS UUID Extraction ──────────────────────────────────────────────────────

/**
 * Busca o UUID real da OS a partir do number (o ViewSet aceita number na URL).
 * Necessário para APIs externas (signatures, billing) que usam UUID como FK.
 */
export async function getOsUuid(page: Page, osNumber: string): Promise<string> {
  const res = await apiGet(page, `/api/proxy/service-orders/${osNumber}/`)
  if (!res.ok) {
    throw new Error(`GET OS ${osNumber} falhou: ${res.status} ${JSON.stringify(res.body)}`)
  }
  const id = (res.body as Record<string, unknown>).id
  if (!id || typeof id !== "string") {
    throw new Error(`UUID não encontrado na resposta da OS ${osNumber}`)
  }
  return id
}

// ─── Photo Upload ────────────────────────────────────────────────────────────

/** PNG 200x80 com traço de assinatura — suficiente para validação do backend */
const SIGNATURE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAABQCAYAAABcbTqwAAABz0lEQVR4nO3c0XKDIBAFUO3//zN97zQtMYJ34ZyXzjhJXGAXUNMcBwAAAAAAAAAAAAAAAAAAAAAAsID24y/c4jzqa4u2iwCVE6kt3DZCfB019WylbLf4WLVZtv3TDtstblUpeXqTX5Fwm3OBVaP3PRXaSpj0pPkk0RUJHzsXWjV6Pye1zQRKTJa7k1qRsMRt3jYomXsv5Fe1U1tvlzKTzpjld1tJ7tqmbu3cbBB3KJLeFWO1dg/xZCc9layrFklPu6wqb3qiYxIGaaUiudKWv1aZqv0wxOzOSErMpFiejD9hwrpTuzP2WZ2QOggVi2RkzKnj9G7spQokPQnT43sizkpbsPbLsRIFUmk2Si6Sp2NrL46fO/SL26m5MafFk1IsU/tlxsO4EedZOSkTYkjcgrWJ5xp6giEXSxN5PpM1KbaBn/2vkdVeYXBTL4ir9l17cfys2i9VB2KG0QMUkQCBW7B24T3DrDIgo4wYrKgECFpVWsdrpns8gM2fWO/W/63zdTH9EhNIOP/6u+ndzriAgr2b6ApjgRs6sYEt9pVy/VyUgXvfqwJQGAsygNf4XeBNGMjrrBhw8ZdYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAI6KvgFBYGUa/S97DgAAAABJRU5ErkJggg=="

/** PNG 1x1 transparente para fotos dummy (menor possível, válido) */
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

/**
 * Faz upload de N fotos dummy para a OS via multipart/form-data.
 * Usado para satisfazer PHOTOS_MIN_12 antes de transições.
 */
export async function uploadDummyPhotos(
  page: Page,
  osId: string,
  count: number,
  folder: string
): Promise<number> {
  const cookieHeader = await getCookieHeader(page)
  const url = `${BASE_URL}/api/proxy/service-orders/${osId}/photos/`
  let uploaded = 0

  for (let i = 0; i < count; i++) {
    try {
      const response = await page.request.post(url, {
        multipart: {
          file: {
            name: `e2e-dummy-${i}.png`,
            mimeType: "image/png",
            buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
          },
          folder,
          caption: `E2E dummy photo ${i + 1}/${count}`,
        },
        headers: {
          Cookie: cookieHeader,
          "X-Tenant-Domain": TENANT_DOMAIN,
        },
      })
      if (response.ok()) uploaded++
    } catch {
      // Continua mesmo se uma foto falhar
    }
  }

  if (uploaded < count) {
    console.warn(`[E2E] uploadDummyPhotos: ${uploaded}/${count} fotos em ${folder}`)
  }
  return uploaded
}

// ─── Prerequisite Helpers ─────────────────────────────────────────────────────

/**
 * Envia PATCH para campos da OS via proxy.
 */
export async function patchOS(
  page: Page,
  osId: string,
  data: Record<string, unknown>
): Promise<ApiResult> {
  const res = await apiPatch(page, `/api/proxy/service-orders/${osId}/`, data)
  if (!res.ok) {
    console.warn(`[E2E] patchOS(${osId}): ${res.status} — ${JSON.stringify(res.body)}`)
  }
  return res
}

/**
 * Cria uma assinatura dummy para a OS. Aceita 201, 200 ou 409 (já existe).
 *
 * @throws Error em qualquer outro status de resposta.
 */
/**
 * Cria assinatura dummy para a OS via docker exec (bypassa auth do proxy).
 * Cria diretamente no Django DB — mais confiável para E2E.
 */
export async function createSignature(
  _page: Page,
  osUuid: string,
  documentType: string
): Promise<void> {
  const { execSync } = await import("child_process")
  const cmd = `docker exec paddock_django python manage.py shell -c "
from django_tenants.utils import schema_context
from apps.signatures.models import Signature
from apps.service_orders.models import ServiceOrder
with schema_context('tenant_dscar'):
    try:
        os_obj = ServiceOrder.objects.get(pk='${osUuid}')
        if not Signature.objects.filter(service_order=os_obj, document_type='${documentType}').exists():
            Signature.objects.create(
                service_order=os_obj,
                document_type='${documentType}',
                method='CANVAS_TABLET',
                signer_name='E2E Test Signer',
                signature_png_base64='${SIGNATURE_PNG_BASE64}',
            )
            print('OK: ${documentType}')
        else:
            print('SKIP: already exists')
    except Exception as e:
        print(f'ERR: {e}')
"`
  try {
    const result = execSync(cmd, { timeout: 15_000, encoding: "utf-8" })
    if (result.includes("ERR:")) {
      console.warn(`[E2E] createSignature(${documentType}): ${result.trim()}`)
    }
  } catch (err) {
    console.warn(`[E2E] createSignature(${documentType}): exec falhou — ${String(err).slice(0, 200)}`)
  }
}

/**
 * Seta campo da OS diretamente no Django DB (bypassa serializer read_only).
 * Útil para campos que o PATCH não consegue setar.
 */
export async function setOsFieldViaDjango(
  osUuid: string,
  field: string,
  value: string
): Promise<void> {
  const { execSync } = await import("child_process")
  const pyValue = value === "NOW" ? "timezone.now()" : `"${value}"`
  // Usa single quotes no shell para evitar problemas de escaping
  const pyCode = [
    "from django.utils import timezone",
    "from django_tenants.utils import schema_context",
    "from apps.service_orders.models import ServiceOrder",
    `with schema_context("tenant_dscar"):`,
    `    os_obj = ServiceOrder.objects.get(pk="${osUuid}")`,
    `    os_obj.${field} = ${pyValue}`,
    `    os_obj.save(update_fields=["${field}"])`,
    `    print("OK")`,
  ].join("\n")
  const cmd = `docker exec paddock_django python manage.py shell -c '${pyCode}'`
  try {
    const result = execSync(cmd, { timeout: 15_000, encoding: "utf-8" })
    if (!result.includes("OK")) {
      console.warn(`[E2E] setOsFieldViaDjango(${field}): ${result.trim()}`)
    }
  } catch (err) {
    console.warn(`[E2E] setOsFieldViaDjango(${field}): ${String(err).slice(0, 200)}`)
  }
}

/**
 * Executa o faturamento (billing) da OS. Emite aviso em caso de falha,
 * mas não lança exceção (billing pode não estar disponível em todos os ambientes).
 */
export async function executeBilling(page: Page, osId: string): Promise<void> {
  const result = await apiPost(
    page,
    `/api/proxy/service-orders/${osId}/billing/`,
    {}
  )

  if (!result.ok) {
    console.warn(
      `[E2E] executeBilling: status ${result.status} para OS ${osId} — ${JSON.stringify(result.body)}`
    )
  }
}

// ─── Plate Helper ─────────────────────────────────────────────────────────────

/**
 * Preenche o campo de placa usando evaluate para disparar eventos React
 * corretamente (campo controlado via handlePlateChange).
 * Faz fallback para digitação manual se o valor não persistir.
 */
export async function fillPlate(page: Page, plate: string): Promise<void> {
  const plateInput = page.locator('input[placeholder="ABC1D23"]')
  await plateInput.click()

  await plateInput.evaluate((el: HTMLInputElement, value: string) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set
    nativeInputValueSetter?.call(el, value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }, plate)

  await page.waitForTimeout(200)

  // Verificar que o valor foi aceito
  const val = await plateInput.inputValue()
  if (!val || val.length < 7) {
    // Fallback: limpar e digitar manualmente via keyboard
    await plateInput.click({ clickCount: 3 })
    await page.keyboard.type(plate)
    await page.waitForTimeout(200)
  }
}
