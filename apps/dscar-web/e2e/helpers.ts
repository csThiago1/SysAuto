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
  // Usa o fetch NATIVO DO BROWSER (page.evaluate) para incluir cookies
  // e X-Tenant-Domain automaticamente via Same-Origin requests.
  // Isso evita problemas de 308 redirect e auth que page.request.fetch tem.
  const result = await page.evaluate(
    async ({ path, method, data }) => {
      try {
        const opts: RequestInit = {
          method,
          headers: { "Content-Type": "application/json" },
        }
        if (data !== undefined && method !== "GET") {
          opts.body = JSON.stringify(data)
        }
        // Remove trailing slash para evitar 308 redirect do Next.js
        const cleanUrl = path.endsWith("/") ? path.slice(0, -1) : path
        const res = await fetch(cleanUrl, opts)
        let body: unknown
        try {
          body = await res.json()
        } catch {
          body = await res.text().catch(() => null)
        }
        return { ok: res.ok, status: res.status, body }
      } catch (err) {
        return { ok: false, status: 0, body: { error: String(err) } }
      }
    },
    { path, method, data }
  )
  return result as ApiResult
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

// ─── Customer Creation ───────────────────────────────────────────────────────

/**
 * Cria um Person com role CLIENT via Django shell. Retorna o ID (PK inteiro).
 * Mais confiável que a criação inline no drawer (que dá timeout com muitos registros).
 */
export async function createCustomerViaDjango(
  name: string,
  phone: string,
  email: string
): Promise<string> {
  const { execSync } = await import("child_process")
  const pyCode = [
    "from django_tenants.utils import schema_context",
    "from apps.persons.models import Person, PersonRole, PersonContact",
    `with schema_context("tenant_dscar"):`,
    `    p = Person.objects.create(person_kind="PF", full_name="${name}")`,
    `    PersonRole.objects.create(person=p, role="CLIENT")`,
    `    PersonContact.objects.create(person=p, contact_type="CELULAR", value="${phone}")`,
    `    PersonContact.objects.create(person=p, contact_type="EMAIL", value="${email}")`,
    `    print(f"OK:{p.pk}")`,
  ].join("\n")
  const cmd = `docker exec paddock_django python manage.py shell -c '${pyCode}'`
  try {
    const result = execSync(cmd, { timeout: 15_000, encoding: "utf-8" })
    const match = result.match(/OK:(.+)/)
    return match ? match[1].trim() : ""
  } catch (err) {
    console.warn(`[E2E] createCustomerViaDjango: ${String(err).slice(0, 200)}`)
    return ""
  }
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
 * Cria apontamento de horas encerrado para um setor da OS.
 * Necessário para satisfazer TIMESHEET_CLOSED antes de transições de oficina.
 */
/**
 * Cria um apontamento de horas encerrado para a OS.
 * O validator _sector_has_timesheet checa qualquer apontamento encerrado.
 * Basta 1 por OS para satisfazer todas as transições de oficina.
 */
export async function ensureClosedTimesheet(
  osUuid: string
): Promise<void> {
  const { execSync } = await import("child_process")
  const pyCode = [
    "from django.utils import timezone",
    "from datetime import timedelta",
    "from decimal import Decimal",
    "from django_tenants.utils import schema_context",
    "from apps.service_orders.models import ServiceOrder",
    "from apps.service_orders.models.capacity import ApontamentoHoras",
    "from apps.authentication.models import GlobalUser",
    `with schema_context("tenant_dscar"):`,
    `    os_obj = ServiceOrder.objects.get(pk="${osUuid}")`,
    `    if not os_obj.apontamentos.filter(status="encerrado").exists():`,
    `        user = GlobalUser.objects.first()`,
    `        now = timezone.now()`,
    `        ApontamentoHoras.objects.create(`,
    `            service_order=os_obj,`,
    `            tecnico=user,`,
    `            iniciado_em=now - timedelta(hours=2),`,
    `            encerrado_em=now,`,
    `            status="encerrado",`,
    `            horas_apontadas=Decimal("2.00"),`,
    `            observacao="E2E pipeline test",`,
    `        )`,
    `        print("OK: created")`,
    `    else:`,
    `        print("OK: exists")`,
  ].join("\n")
  const cmd = `docker exec paddock_django python manage.py shell -c '${pyCode}'`
  try {
    const result = execSync(cmd, { timeout: 15_000, encoding: "utf-8" })
    if (!result.includes("OK")) {
      console.warn(`[E2E] ensureClosedTimesheet: ${result.trim()}`)
    }
  } catch (err) {
    console.warn(`[E2E] ensureClosedTimesheet: ${String(err).slice(0, 200)}`)
  }
}

/**
 * Cria versão de orçamento autorizada para a OS (necessário para seguradora).
 */
export async function createAuthorizedVersion(
  osUuid: string
): Promise<void> {
  const { execSync } = await import("child_process")
  const pyCode = [
    "from decimal import Decimal",
    "from django_tenants.utils import schema_context",
    "from apps.service_orders.models import ServiceOrder",
    "from apps.service_orders.models.versioning import ServiceOrderVersion",
    `with schema_context("tenant_dscar"):`,
    `    os_obj = ServiceOrder.objects.get(pk="${osUuid}")`,
    `    if not os_obj.versions.filter(status__in=["autorizado","approved"]).exists():`,
    `        max_v = os_obj.versions.aggregate(m=__import__("django.db.models",fromlist=["Max"]).Max("version_number"))["m"] or 0`,
    `        ServiceOrderVersion.objects.create(`,
    `            service_order=os_obj,`,
    `            version_number=max_v + 1,`,
    `            source="manual",`,
    `            status="autorizado",`,
    `            subtotal=Decimal("1000"),`,
    `            net_total=Decimal("1000"),`,
    `            labor_total=Decimal("500"),`,
    `            parts_total=Decimal("500"),`,
    `        )`,
    `        print("OK")`,
    `    else:`,
    `        print("SKIP")`,
  ].join("\n")
  const cmd = `docker exec paddock_django python manage.py shell -c '${pyCode}'`
  try {
    const result = execSync(cmd, { timeout: 15_000, encoding: "utf-8" })
    if (result.includes("Traceback")) {
      console.warn(`[E2E] createAuthorizedVersion: ${result.trim().slice(0, 300)}`)
    }
  } catch (err) {
    console.warn(`[E2E] createAuthorizedVersion: ${String(err).slice(0, 200)}`)
  }
}

/**
 * Cria checklist de saída (EXIT_CHECKLIST) para a OS.
 */
export async function createExitChecklist(osUuid: string): Promise<void> {
  const { execSync } = await import("child_process")
  const pyCode = [
    "from django_tenants.utils import schema_context",
    "from apps.service_orders.models import ServiceOrder",
    "from apps.service_orders.models.items import ChecklistItem",
    `with schema_context("tenant_dscar"):`,
    `    os_obj = ServiceOrder.objects.get(pk="${osUuid}")`,
    `    if not os_obj.checklist_items.filter(checklist_type="saida").exists():`,
    `        ChecklistItem.objects.create(service_order=os_obj, checklist_type="saida", category="bodywork", item_key="estado_geral", status="ok", notes="E2E test")`,
    `        print("OK")`,
    `    else:`,
    `        print("SKIP")`,
  ].join("\n")
  const cmd = `docker exec paddock_django python manage.py shell -c '${pyCode}'`
  try {
    execSync(cmd, { timeout: 15_000, encoding: "utf-8" })
  } catch (err) {
    console.warn(`[E2E] createExitChecklist: ${String(err).slice(0, 200)}`)
  }
}

/**
 * Marca todas as peças ativas da OS como "recebida".
 * Necessário para satisfazer ALL_PARTS_RECEIVED na transição washing → final_survey.
 */
export async function markAllPartsReceived(osUuid: string): Promise<void> {
  const { execSync } = await import("child_process")
  const pyCode = [
    "from django_tenants.utils import schema_context",
    "from apps.service_orders.models import ServiceOrder",
    `with schema_context("tenant_dscar"):`,
    `    os_obj = ServiceOrder.objects.get(pk="${osUuid}")`,
    `    updated = os_obj.parts.filter(is_active=True).exclude(status_peca__in=["bloqueada","recebida"]).update(status_peca="recebida")`,
    `    print(f"OK: {updated} parts updated")`,
  ].join("\n")
  const cmd = `docker exec paddock_django python manage.py shell -c '${pyCode}'`
  try {
    const result = execSync(cmd, { timeout: 15_000, encoding: "utf-8" })
    if (!result.includes("OK")) {
      console.warn(`[E2E] markAllPartsReceived: ${result.trim()}`)
    }
  } catch (err) {
    console.warn(`[E2E] markAllPartsReceived: ${String(err).slice(0, 200)}`)
  }
}

/**
 * Executa o faturamento (billing) da OS. Emite aviso em caso de falha,
 * mas não lança exceção (billing pode não estar disponível em todos os ambientes).
 */
/**
 * Cria um ReceivableDocument dummy para a OS.
 * Necessário para satisfazer RECEIVABLE_CREATED na transição ready → delivered.
 */
export async function createReceivable(osUuid: string): Promise<void> {
  const { execSync } = await import("child_process")
  const pyCode = [
    "from decimal import Decimal",
    "from django.utils import timezone",
    "from datetime import timedelta",
    "from django_tenants.utils import schema_context",
    "from apps.accounts_receivable.models import ReceivableDocument",
    `with schema_context("tenant_dscar"):`,
    `    from apps.service_orders.models import ServiceOrder`,
    `    os_obj = ServiceOrder.objects.get(pk="${osUuid}")`,
    `    if not ReceivableDocument.objects.filter(service_order_id="${osUuid}", is_active=True).exists():`,
    `        ReceivableDocument.objects.create(`,
    `            service_order_id="${osUuid}",`,
    `            customer_id=os_obj.customer_id,`,
    `            customer_name=os_obj.customer_name or "E2E Client",`,
    `            description="Faturamento E2E pipeline test",`,
    `            document_number="E2E-" + str(os_obj.number),`,
    `            document_date=timezone.now().date(),`,
    `            amount=Decimal("1000.00"),`,
    `            amount_received=Decimal("0"),`,
    `            due_date=timezone.now().date() + timedelta(days=30),`,
    `            competence_date=timezone.now().date(),`,
    `            status="pending",`,
    `            origin="manual",`,
    `            is_active=True,`,
    `        )`,
    `        print("OK")`,
    `    else:`,
    `        print("SKIP")`,
  ].join("\n")
  const cmd = `docker exec paddock_django python manage.py shell -c '${pyCode}'`
  try {
    const result = execSync(cmd, { timeout: 15_000, encoding: "utf-8" })
    if (result.includes("Traceback")) {
      console.warn(`[E2E] createReceivable: ${result.trim().slice(0, 300)}`)
    }
  } catch (err) {
    console.warn(`[E2E] createReceivable: ${String(err).slice(0, 200)}`)
  }
}

export async function executeBilling(page: Page, osId: string): Promise<void> {
  // Primeiro busca o preview para obter os items de billing
  const preview = await apiGet(page, `/api/proxy/service-orders/${osId}/billing/preview/`)
  let items: unknown[] = []
  if (preview.ok && preview.body) {
    const body = preview.body as Record<string, unknown>
    items = (body.items ?? body.billing_items ?? []) as unknown[]
  }

  const result = await apiPost(
    page,
    `/api/proxy/service-orders/${osId}/billing/`,
    items.length > 0 ? { items } : {}
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
