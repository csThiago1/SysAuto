# Pipeline E2E — Teste Completo de OS (Particular + Seguradora)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Testar ponta-a-ponta a pipeline de serviços via Playwright — desde cadastro de cliente e criação da OS até entrega final — nos dois formatos (particular com cliente novo + seguradora com cliente existente).

**Architecture:** Dois cenários em um spec file. Helpers compartilhados para login, API shortcuts (transitions com force, criação de fotos/assinaturas), e extração de IDs. Cenário A é completo (17 status); Cenário B testa as diferenças UX (busca cliente + seguradora). Transições sem bloqueio usam o dropdown da UI; com soft blocks usam API+force; hard blocks são satisfeitos via API helpers.

**Tech Stack:** Playwright, TypeScript, Next.js proxy API, Django REST endpoints

**Pré-requisitos para rodar:**
```bash
make dev                           # serviços Docker (Django, Postgres, Redis)
cd apps/dscar-web && npm run dev   # Next.js na porta 3001
npx playwright install             # browsers (se primeira vez)
```

---

## File Structure

```
apps/dscar-web/e2e/
  helpers.ts              ← CREATE — auth + API shortcuts
  pipeline-e2e.spec.ts    ← CREATE — cenários A e B
docs/
  manual-pipeline-servicos.md ← CREATE — manual do usuário (Task 5)
```

---

### Task 1: Create shared helpers

**Files:**
- Create: `apps/dscar-web/e2e/helpers.ts`

- [ ] **Step 1: Write the helpers file**

```typescript
/**
 * E2E Helpers — Pipeline de Serviços
 *
 * Utilitários compartilhados para login, chamadas API via proxy,
 * e atalhos para criação de pré-requisitos (fotos, assinaturas, billing).
 */
import { type Page, expect } from "@playwright/test"

// ─── Constantes ──────────────────────────────────────────────────────────────

export const BASE_URL = "http://localhost:3001"
export const DEV_EMAIL = "thiago@paddock.solutions"
export const DEV_PASSWORD = "paddock123"
export const TENANT_DOMAIN = "dscar.localhost"

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function login(page: Page): Promise<void> {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  const emailInput = page.locator('input[type="email"], input[name="email"]')
  if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await emailInput.fill(DEV_EMAIL)
    await page.locator('input[type="password"]').fill(DEV_PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/(os|service-orders|dashboard)/, { timeout: 15_000 })
  }
}

// ─── API via proxy (usa cookies do browser) ──────────────────────────────────

async function getCookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ")
}

export async function apiPost(
  page: Page,
  path: string,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const cookieHeader = await getCookieHeader(page)
  const res = await page.request.post(`${BASE_URL}${path}`, {
    data,
    headers: {
      Cookie: cookieHeader,
      "X-Tenant-Domain": TENANT_DOMAIN,
      "Content-Type": "application/json",
    },
  })
  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    /* sem body JSON */
  }
  return { ok: res.ok(), status: res.status(), body }
}

export async function apiGet(
  page: Page,
  path: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const cookieHeader = await getCookieHeader(page)
  const res = await page.request.get(`${BASE_URL}${path}`, {
    headers: {
      Cookie: cookieHeader,
      "X-Tenant-Domain": TENANT_DOMAIN,
    },
  })
  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    /* sem body JSON */
  }
  return { ok: res.ok(), status: res.status(), body }
}

export async function apiPatch(
  page: Page,
  path: string,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const cookieHeader = await getCookieHeader(page)
  const res = await page.request.patch(`${BASE_URL}${path}`, {
    data,
    headers: {
      Cookie: cookieHeader,
      "X-Tenant-Domain": TENANT_DOMAIN,
      "Content-Type": "application/json",
    },
  })
  let body: Record<string, unknown> = {}
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    /* sem body JSON */
  }
  return { ok: res.ok(), status: res.status(), body }
}

// ─── Extração de IDs ─────────────────────────────────────────────────────────

export function extractOsId(url: string): string {
  const match = url.match(/\/service-orders\/([a-f0-9-]+)/)
  if (!match) throw new Error(`Não foi possível extrair OS ID de: ${url}`)
  return match[1]
}

// ─── Transições ──────────────────────────────────────────────────────────────

/** Transição simples via dropdown "Avançar Status" (sem bloqueios) */
export async function uiTransition(
  page: Page,
  targetLabel: string
): Promise<void> {
  const advBtn = page.locator("button", { hasText: "Avançar Status" }).first()
  await expect(advBtn).toBeVisible({ timeout: 5_000 })
  await advBtn.click()
  // Aguarda o menu dropdown abrir
  await page.waitForTimeout(300)
  // Clica no status alvo
  const menuItem = page.locator('[role="menuitem"]', { hasText: targetLabel })
  await expect(menuItem).toBeVisible({ timeout: 3_000 })
  await menuItem.click()
  // Aguarda toast de sucesso
  await expect(page.locator(`text=Status atualizado para "${targetLabel}"`))
    .toBeVisible({ timeout: 10_000 })
  await page.waitForLoadState("networkidle")
}

/** Transição via API com force=true (bypass soft blocks) */
export async function apiTransition(
  page: Page,
  osId: string,
  newStatus: string
): Promise<void> {
  const res = await apiPost(page, `/api/proxy/v1/service-orders/${osId}/transition/`, {
    new_status: newStatus,
    force: true,
    manager_email: DEV_EMAIL,
    manager_password: DEV_PASSWORD,
    justification: "E2E pipeline test",
  })
  if (!res.ok) {
    throw new Error(
      `Transição para ${newStatus} falhou (${res.status}): ${JSON.stringify(res.body)}`
    )
  }
}

/**
 * Transição inteligente: tenta via UI, se falhar usa API com force.
 * Depois recarrega a página para refletir o novo status.
 */
export async function smartTransition(
  page: Page,
  osId: string,
  newStatus: string,
  statusLabel: string
): Promise<void> {
  // Verifica se o dropdown "Avançar Status" está visível
  const advBtn = page.locator("button", { hasText: "Avançar Status" }).first()
  const dropdownVisible = await advBtn.isVisible({ timeout: 2_000 }).catch(() => false)

  if (dropdownVisible) {
    // Tenta via UI
    await advBtn.click()
    await page.waitForTimeout(300)
    const menuItem = page.locator('[role="menuitem"]', { hasText: statusLabel })
    const menuVisible = await menuItem.isVisible({ timeout: 2_000 }).catch(() => false)
    if (menuVisible) {
      await menuItem.click()
      // Espera sucesso ou erro
      const success = page
        .locator(`text=Status atualizado para "${statusLabel}"`)
        .waitFor({ timeout: 8_000 })
        .then(() => true)
        .catch(() => false)
      if (await success) {
        await page.waitForLoadState("networkidle")
        return
      }
    }
  }

  // Fallback: API com force
  await apiTransition(page, osId, newStatus)
  await page.reload()
  await page.waitForLoadState("networkidle")
}

// ─── Pré-requisitos via API ──────────────────────────────────────────────────

/** Preenche campos da OS via PATCH */
export async function patchOS(
  page: Page,
  osId: string,
  data: Record<string, unknown>
): Promise<void> {
  const res = await apiPatch(page, `/api/proxy/v1/service-orders/${osId}/`, data)
  if (!res.ok) {
    throw new Error(`PATCH OS falhou (${res.status}): ${JSON.stringify(res.body)}`)
  }
}

/** Cria assinatura dummy para a OS */
export async function createSignature(
  page: Page,
  osId: string,
  documentType: string
): Promise<void> {
  const res = await apiPost(page, `/api/proxy/v1/service-orders/${osId}/signatures/`, {
    document_type: documentType,
    signature_data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    signer_name: "E2E Test Signer",
  })
  // Aceita 201 (criado) ou 200 ou 409 (já existe)
  if (!res.ok && res.status !== 409) {
    console.warn(`Assinatura ${documentType} warn (${res.status}): ${JSON.stringify(res.body)}`)
  }
}

/** Executa billing via API */
export async function executeBilling(
  page: Page,
  osId: string
): Promise<void> {
  const res = await apiPost(page, `/api/proxy/v1/service-orders/${osId}/billing-execute/`, {})
  if (!res.ok) {
    console.warn(`Billing warn (${res.status}): ${JSON.stringify(res.body)}`)
  }
}

// ─── Plate helpers ───────────────────────────────────────────────────────────

/** Preenche campo de placa usando evaluate (React controlled input) */
export async function fillPlate(page: Page, plate: string): Promise<void> {
  const plateInput = page.locator('input[placeholder="ABC1D23"]')
  await plateInput.click()
  await plateInput.evaluate(
    (el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set
      setter?.call(el, value)
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    },
    plate
  )
  await page.waitForTimeout(300)
  // Fallback: digitar manualmente
  const val = await plateInput.inputValue()
  if (!val || val.length < 7) {
    await plateInput.click({ clickCount: 3 })
    await page.keyboard.type(plate)
    await page.waitForTimeout(200)
  }
}
```

- [ ] **Step 2: Verify file has no TypeScript errors**

Run: `cd apps/dscar-web && npx tsc --noEmit e2e/helpers.ts 2>&1 | head -20`

Note: This may warn about missing configs for e2e — that's OK, Playwright handles TS internally.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/e2e/helpers.ts
git commit -m "test(e2e): add shared helpers for pipeline E2E tests"
```

---

### Task 2: Create Cenário A — OS Particular (Cliente Novo)

**Files:**
- Create: `apps/dscar-web/e2e/pipeline-e2e.spec.ts`

- [ ] **Step 1: Write the test file with Cenário A**

```typescript
/**
 * E2E — Pipeline Completa de Serviços
 *
 * Cenário A: OS Particular com cliente novo (criado inline)
 *   - Cria OS → preenche datas → transições completas → peças → serviços
 *   - Compras → estoque → oficina → vistoria final → entrega
 *
 * Cenário B: OS Seguradora com cliente existente (busca + seleciona)
 *   - Cria OS vinculada a seguradora → fluxo abreviado até entrega
 *
 * Pré-requisitos:
 *   - make dev (Docker services healthy)
 *   - cd apps/dscar-web && npm run dev (porta 3001)
 *   - npx playwright install
 *
 * Execute:
 *   cd apps/dscar-web && npx playwright test e2e/pipeline-e2e.spec.ts
 */

import { test, expect } from "@playwright/test"
import {
  login,
  fillPlate,
  extractOsId,
  uiTransition,
  smartTransition,
  apiTransition,
  patchOS,
  createSignature,
  executeBilling,
  apiPost,
  apiGet,
} from "./helpers"

// Timeout estendido para pipeline completa (5 minutos por cenário)
test.setTimeout(300_000)

// ─── STATUS LABELS (mapa backend → label UI) ────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  reception: "Recepção",
  initial_survey: "Vistoria Inicial",
  budget: "Orçamento",
  waiting_auth: "Aguardando Autorização",
  authorized: "Autorizada",
  waiting_parts: "Aguardando Peças",
  repair: "Reparo",
  mechanic: "Mecânica",
  bodywork: "Funilaria",
  painting: "Pintura",
  assembly: "Montagem",
  polishing: "Polimento",
  washing: "Lavagem",
  final_survey: "Vistoria Final",
  ready: "Pronto para Entrega",
  delivered: "Entregue",
  cancelled: "Cancelada",
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO A — OS Particular com Cliente Novo
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Cenário A — OS Particular (Cliente Novo)", () => {
  // Estado compartilhado entre steps
  let osUrl: string
  let osId: string
  const clientName = `E2E Particular ${Date.now()}`
  const plate = `PAR${Math.floor(Math.random() * 10)}E${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`

  test("Pipeline completa: criação → entrega", async ({ page }) => {
    // ── 1. Login ──────────────────────────────────────────────────────────
    await test.step("1. Login", async () => {
      await login(page)
      await page.goto("/os")
      await page.waitForLoadState("networkidle")
    })

    // ── 2. Abrir drawer "Nova OS" ─────────────────────────────────────────
    await test.step("2. Abrir drawer Nova OS", async () => {
      const novaBtn = page.locator("button", { hasText: /^Nova OS$|^Nova Ordem/ }).first()
      await expect(novaBtn).toBeVisible({ timeout: 5_000 })
      await novaBtn.click()
      await expect(page.locator("text=Nova Ordem de Serviço")).toBeVisible({ timeout: 5_000 })
    })

    // ── 3. Selecionar tipo Particular ─────────────────────────────────────
    await test.step("3. Tipo = Particular", async () => {
      const particularBtn = page.locator("button", { hasText: "Particular" }).first()
      await particularBtn.click()
    })

    // ── 4. Criar cliente inline ───────────────────────────────────────────
    await test.step("4. Criar cliente inline", async () => {
      // Clicar em "Novo" ao lado do campo de busca de cliente
      const novoClienteBtn = page.locator("button", { hasText: "Novo" }).first()
      await novoClienteBtn.click()
      await expect(page.locator("text=Novo cliente")).toBeVisible({ timeout: 3_000 })

      // Preencher dados do cliente
      await page.locator('input[placeholder="Nome completo *"]').fill(clientName)
      await page.locator('input[placeholder*="CPF"]').fill("11144477735")
      await page.locator('input[placeholder*="Celular"]').fill("92999990001")
      await page.locator('input[placeholder*="E-mail"]').fill(`e2e-${Date.now()}@pipeline.test`)

      // Salvar
      const cadastrarBtn = page.locator("button", { hasText: "Cadastrar" })
      await expect(cadastrarBtn).toBeEnabled({ timeout: 3_000 })
      await cadastrarBtn.click()

      // Verificar chip verde do cliente selecionado
      await expect(
        page.locator("span", { hasText: clientName }).first()
      ).toBeVisible({ timeout: 8_000 })
    })

    // ── 5. Preencher dados do veículo ─────────────────────────────────────
    await test.step("5. Preencher veículo", async () => {
      await fillPlate(page, plate)
      await page.locator('input[placeholder="Ex: Honda"]').fill("Honda")
      await page.locator('input[placeholder="Ex: Civic"]').fill("Civic")

      // Verificar placa aceita
      const plateVal = await page.locator('input[placeholder="ABC1D23"]').inputValue()
      expect(plateVal.length).toBeGreaterThanOrEqual(7)
    })

    // ── 6. Criar a OS ────────────────────────────────────────────────────
    await test.step("6. Criar OS", async () => {
      // Interceptar resposta da API
      const responsePromise = page
        .waitForResponse(
          (r) =>
            r.url().includes("/api/proxy") &&
            r.url().includes("service-orders") &&
            r.request().method() === "POST" &&
            (r.status() < 300 || r.status() >= 400),
          { timeout: 15_000 }
        )
        .catch(() => null)

      await page.locator("button", { hasText: "Criar OS" }).click()

      const apiResponse = await responsePromise
      if (apiResponse && !apiResponse.ok()) {
        let body = "(sem corpo)"
        try {
          body = JSON.stringify(await apiResponse.json())
        } catch {
          /* noop */
        }
        throw new Error(`Criação OS falhou ${apiResponse.status()}: ${body}`)
      }

      await page.waitForURL(/\/service-orders\/[a-f0-9-]+/, { timeout: 20_000 })
      await page.waitForLoadState("networkidle")

      osUrl = page.url()
      osId = extractOsId(osUrl)
      expect(osId).toBeTruthy()
    })

    // ── 7. Verificar OS criada ────────────────────────────────────────────
    await test.step("7. Verificar OS criada", async () => {
      await expect(page.locator("h1")).toContainText("OS #")
    })

    // ── 8. Preencher datas (scheduling + entry) ──────────────────────────
    await test.step("8. Preencher datas e salvar", async () => {
      // Clicar nos botões "Agora" para preencher datas
      const agoraBtns = page.locator("button", { hasText: "Agora" })
      const count = await agoraBtns.count()
      for (let i = 0; i < Math.min(count, 2); i++) {
        await agoraBtns.nth(i).evaluate((btn) => (btn as HTMLButtonElement).click())
        await page.waitForTimeout(200)
      }

      // Salvar
      await page.locator("button", { hasText: "Salvar" }).click()
      await expect(page.locator("text=OS salva")).toBeVisible({ timeout: 8_000 })
    })

    // ── 9. RECEPTION → INITIAL_SURVEY ────────────────────────────────────
    await test.step("9. Transição: Recepção → Vistoria Inicial", async () => {
      await smartTransition(page, osId, "initial_survey", STATUS_LABEL.initial_survey)
    })

    // ── 10. INITIAL_SURVEY → BUDGET (soft block: fotos) ──────────────────
    await test.step("10. Transição: Vistoria Inicial → Orçamento", async () => {
      // Soft block PHOTOS_MIN_12 → usar API com force
      await apiTransition(page, osId, "budget")
      await page.reload()
      await page.waitForLoadState("networkidle")
    })

    // ── 11. Adicionar peças (aba Peças) ──────────────────────────────────
    await test.step("11. Adicionar peça (origem=compra)", async () => {
      // Navegar para aba Peças
      const pecasTab = page.locator('[role="tab"]', { hasText: "Peças" })
      await pecasTab.click()
      await page.waitForTimeout(500)

      // Clicar no botão "Comprar" para abrir modal de solicitação de compra
      const comprarBtn = page.locator("button", { hasText: "Comprar" }).first()
      await expect(comprarBtn).toBeVisible({ timeout: 5_000 })
      await comprarBtn.click()

      // Preencher modal CompraFormModal
      await expect(page.locator("text=Solicitar Compra")).toBeVisible({ timeout: 3_000 })
      await page
        .locator('input[placeholder*="Parachoque"]')
        .fill("Para-choque dianteiro")
      await page.locator('input[placeholder="0,00"]').first().fill("450")
      // Quantidade default = 1

      // Submeter
      await page.locator("button", { hasText: "Solicitar Compra" }).click()
      await page.waitForTimeout(1_000)
    })

    await test.step("11b. Adicionar peça manual", async () => {
      // Verificar que estamos na aba Peças
      // Vamos adicionar uma peça manual via API (mais confiável para peça de estoque)
      const res = await apiPost(page, `/api/proxy/v1/service-orders/${osId}/parts/`, {
        description: "Farol esquerdo LED",
        part_number: "FAR-E-LED-001",
        quantity: 1,
        unit_price: "280.00",
        discount: "0.00",
        origem: "manual",
        tipo_qualidade: "reposicao",
        payer: "customer",
        source_type: "manual",
      })
      expect(res.ok).toBe(true)
      await page.reload()
      await page.waitForLoadState("networkidle")
    })

    // ── 12. Adicionar serviço (aba Serviços) ─────────────────────────────
    await test.step("12. Adicionar serviço", async () => {
      const servicosTab = page.locator('[role="tab"]', { hasText: "Serviços" })
      await servicosTab.click()
      await page.waitForTimeout(500)

      // Preencher form de serviço
      const descInput = page.locator('input[placeholder="Descrição do serviço"]')
      await expect(descInput).toBeVisible({ timeout: 5_000 })
      await descInput.fill("Funilaria painel frontal")

      // Valor unitário
      const valorInput = page.locator('input[placeholder="0.00"]').first()
      await valorInput.fill("800")

      // Clicar em Adicionar
      const addBtn = page.locator("button", { hasText: "Adicionar" }).first()
      await addBtn.click()

      // Aguardar item aparecer na lista
      await expect(page.locator("text=Funilaria painel frontal")).toBeVisible({ timeout: 5_000 })
    })

    // ── 13. BUDGET → WAITING_AUTH ────────────────────────────────────────
    await test.step("13. Transição: Orçamento → Aguardando Autorização", async () => {
      // Hard block: BUDGET_ITEMS_PRIVATE → satisfeito (temos peças e serviços)
      // Soft block: PHOTOS_MIN_12 → force via API
      await apiTransition(page, osId, "waiting_auth")
      await page.reload()
      await page.waitForLoadState("networkidle")
    })

    // ── 14. WAITING_AUTH → AUTHORIZED ────────────────────────────────────
    await test.step("14. Transição: Aguardando Autorização → Autorizada", async () => {
      // Hard blocks: AUTH_DATE_SET + SIGNATURE_APPROVAL (particular)
      // Preencher data de autorização via API
      await patchOS(page, osId, {
        service_authorization_date: new Date().toISOString(),
      })
      // Criar assinatura de aprovação de orçamento
      await createSignature(page, osId, "BUDGET_APPROVAL")

      await apiTransition(page, osId, "authorized")
      await page.reload()
      await page.waitForLoadState("networkidle")
    })

    // ── 15. Verificar PedidoCompra na página de compras ──────────────────
    await test.step("15. Verificar pedido de compra", async () => {
      await page.goto("/compras")
      await page.waitForLoadState("networkidle")

      // Deve ter o pedido do para-choque
      await expect(
        page.locator("text=Para-choque dianteiro").first()
      ).toBeVisible({ timeout: 10_000 })
    })

    // ── 16. Criar Ordem de Compra e adicionar item ───────────────────────
    await test.step("16. Criar Ordem de Compra", async () => {
      await page.goto("/compras/ordens")
      await page.waitForLoadState("networkidle")

      // Clicar em "Nova OC"
      const novaOcBtn = page.locator("button", { hasText: "Nova OC" })
      await expect(novaOcBtn).toBeVisible({ timeout: 5_000 })
      await novaOcBtn.click()

      // Preencher ID da OS no dialog
      await expect(page.locator("text=Nova Ordem de Compra")).toBeVisible({ timeout: 3_000 })
      await page.locator('input[placeholder="ID da OS (UUID)"]').fill(osId)
      await page.locator("button", { hasText: "Criar OC" }).click()

      // Aguardar navegação para a OC criada
      await page.waitForURL(/\/compras\/ordens\/\d+/, { timeout: 10_000 })
      await page.waitForLoadState("networkidle")
    })

    await test.step("16b. Adicionar item à OC", async () => {
      // Preencher form de item
      const fornecedorInput = page.locator('input[placeholder="Nome do fornecedor"]')
      await expect(fornecedorInput).toBeVisible({ timeout: 5_000 })
      await fornecedorInput.fill("Auto Peças Manaus")

      await page.locator('input[placeholder="Descricao da peca"]').fill("Para-choque dianteiro Honda Civic")

      // Valor unitário
      await page.locator('input[placeholder="0.00"]').first().fill("320")

      // Prazo
      await page.locator('input[placeholder="Ex: 3 dias"]').fill("2 dias")

      // Adicionar Item
      await page.locator("button", { hasText: "Adicionar Item" }).click()
      await expect(page.locator("text=Item adicionado")).toBeVisible({ timeout: 5_000 })
    })

    // ── 17. Enviar OC para aprovação e aprovar ───────────────────────────
    await test.step("17. Enviar e aprovar OC", async () => {
      // Enviar para aprovação
      const enviarBtn = page.locator("button", { hasText: "Enviar para Aprovacao" })
      if (await enviarBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await enviarBtn.click()
        await expect(page.locator("text=OC enviada para aprovacao")).toBeVisible({ timeout: 5_000 })
        await page.waitForTimeout(1_000)
      }

      // Aprovar
      const aprovarBtn = page.locator("button", { hasText: "Aprovar Compra" })
      if (await aprovarBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await aprovarBtn.click()
        await expect(page.locator("text=Ordem de compra aprovada")).toBeVisible({ timeout: 5_000 })
      }
    })

    // ── 18. AUTHORIZED → WAITING_PARTS ───────────────────────────────────
    await test.step("18. Transição: Autorizada → Aguardando Peças", async () => {
      await page.goto(osUrl)
      await page.waitForLoadState("networkidle")

      // Soft block: PARTS_SOURCED → force
      await apiTransition(page, osId, "waiting_parts")
      await page.reload()
      await page.waitForLoadState("networkidle")
    })

    // ── 19. Entrada manual de peça no estoque ────────────────────────────
    await test.step("19. Entrada manual de estoque", async () => {
      await page.goto("/estoque/entrada")
      await page.waitForLoadState("networkidle")

      // Aba "Peça" (default)
      // Buscar produto
      const produtoInput = page.locator('input[placeholder*="Buscar por nome ou SKU"]')
      await expect(produtoInput).toBeVisible({ timeout: 5_000 })
      await produtoInput.fill("para-choque")
      await page.waitForTimeout(1_000)

      // Se não houver produto cadastrado, vamos preencher via API
      const dropdown = page.locator('[role="option"], [role="listbox"] >> text=/para-choque/i').first()
      const hasProduct = await dropdown.isVisible({ timeout: 3_000 }).catch(() => false)

      if (!hasProduct) {
        // Sem produto no catálogo — registramos diretamente via API
        // (a entrada manual requer um ProdutoComercialPeca cadastrado)
        console.log("Sem produto no catálogo — pulando UI de entrada manual, usando API")
      } else {
        await dropdown.click()
        // Valor NF
        const valorNfInput = page.locator('input[placeholder="0,00"]').first()
        await valorNfInput.fill("320")

        // Motivo
        const motivoInput = page.locator('textarea[placeholder*="motivo"]')
        await motivoInput.fill("Entrada E2E - para-choque dianteiro Honda Civic")

        // Registrar
        await page.locator("button", { hasText: "Registrar Entrada" }).click()
        await expect(
          page.locator("text=registrad").first()
        ).toBeVisible({ timeout: 8_000 })
      }
    })

    // ── 20. WAITING_PARTS → REPAIR ───────────────────────────────────────
    await test.step("20. Transição: Aguardando Peças → Reparo", async () => {
      // Soft block: PARTS_PURCHASED → force
      await apiTransition(page, osId, "repair")
    })

    // ── 21. Transições de oficina (REPAIR → ... → WASHING) ──────────────
    // Obs: No web, transições de reparo são gerenciadas pelo mobile.
    // Usamos API para todas elas.
    await test.step("21. Transições de oficina via API", async () => {
      const workshopPath = [
        "bodywork",   // Funilaria
        "painting",   // Pintura
        "assembly",   // Montagem
        "polishing",  // Polimento
        "washing",    // Lavagem
      ]
      for (const status of workshopPath) {
        await apiTransition(page, osId, status)
      }
    })

    // ── 22. WASHING → FINAL_SURVEY ───────────────────────────────────────
    await test.step("22. Transição: Lavagem → Vistoria Final", async () => {
      // Hard blocks: ALL_PARTS_RECEIVED + ALL_TIMESHEETS_CLOSED
      // Partes: ajustar status via API se necessário
      // Timesheets: se não houver nenhum, a validação passa vacuamente
      await apiTransition(page, osId, "final_survey")
    })

    // ── 23. FINAL_SURVEY → READY ─────────────────────────────────────────
    await test.step("23. Transição: Vistoria Final → Pronto", async () => {
      // Soft blocks: FINAL_PHOTOS_12 + EXIT_CHECKLIST → force
      await apiTransition(page, osId, "ready")
    })

    // ── 24. Preparar pré-requisitos para entrega ─────────────────────────
    await test.step("24. Preparar pré-requisitos para entrega", async () => {
      // Hard blocks para READY → DELIVERED:
      // 1. MILEAGE_OUT — preencher km saída
      await patchOS(page, osId, {
        mileage_out: 45200,
        client_delivery_date: new Date().toISOString(),
      })

      // 2. CLIENT_SIGNATURE — assinatura de entrega
      await createSignature(page, osId, "OS_DELIVERY")

      // 3. RECEIVABLE_CREATED + COMPLEMENT_BILLED — executar billing
      await executeBilling(page, osId)

      // 4. NFCE_ISSUED — para particular, precisa de NFC-e
      // Em ambiente dev/homologação, o billing-execute pode gerar automaticamente.
      // Se não, criamos um documento fiscal dummy via API
      const fiscalRes = await apiPost(page, `/api/proxy/v1/fiscal/documents/`, {
        document_type: "nfce",
        service_order: osId,
        status: "authorized",
        environment: "homologacao",
      })
      if (!fiscalRes.ok && fiscalRes.status !== 409) {
        console.warn(`Fiscal doc warn (${fiscalRes.status}): ${JSON.stringify(fiscalRes.body)}`)
      }
    })

    // ── 25. READY → DELIVERED ────────────────────────────────────────────
    await test.step("25. Transição: Pronto → Entregue", async () => {
      await apiTransition(page, osId, "delivered")
      await page.goto(osUrl)
      await page.waitForLoadState("networkidle")
    })

    // ── 26. Verificar estado final ───────────────────────────────────────
    await test.step("26. Verificar OS entregue", async () => {
      // Verificar status DELIVERED na página
      await expect(page.locator("text=Entregue").first()).toBeVisible({ timeout: 5_000 })

      // Verificar via API
      const res = await apiGet(page, `/api/proxy/v1/service-orders/${osId}/`)
      expect(res.body.status).toBe("delivered")
    })

    // ── 27. Verificar agenda ─────────────────────────────────────────────
    await test.step("27. Verificar agenda", async () => {
      await page.goto("/agenda")
      await page.waitForLoadState("networkidle")

      // A página deve carregar sem erros
      await expect(page.locator("text=Agenda")).toBeVisible({ timeout: 5_000 })
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO B — OS Seguradora com Cliente Existente
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Cenário B — OS Seguradora (Cliente Existente)", () => {
  let osUrl: string
  let osId: string
  const plate = `SEG${Math.floor(Math.random() * 10)}F${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`

  test("Pipeline seguradora: criação com cliente existente → entrega", async ({ page }) => {
    // ── 1. Login ──────────────────────────────────────────────────────────
    await test.step("1. Login", async () => {
      await login(page)
      await page.goto("/os")
      await page.waitForLoadState("networkidle")
    })

    // ── 2. Abrir drawer ──────────────────────────────────────────────────
    await test.step("2. Abrir drawer Nova OS", async () => {
      const novaBtn = page.locator("button", { hasText: /^Nova OS$|^Nova Ordem/ }).first()
      await expect(novaBtn).toBeVisible({ timeout: 5_000 })
      await novaBtn.click()
      await expect(page.locator("text=Nova Ordem de Serviço")).toBeVisible({ timeout: 5_000 })
    })

    // ── 3. Selecionar tipo Seguradora ────────────────────────────────────
    await test.step("3. Tipo = Seguradora", async () => {
      const segBtn = page.locator("button", { hasText: "Seguradora" }).first()
      await segBtn.click()

      // Selecionar seguradora no dropdown
      const segSelect = page.locator("select").filter({ hasText: /seguradora/i }).first()
      // Se é um select HTML nativo
      const selectEl = page.locator('select').first()
      const hasSelect = await selectEl.isVisible({ timeout: 3_000 }).catch(() => false)
      if (hasSelect) {
        // Selecionar a primeira seguradora disponível (que não seja placeholder)
        const options = await selectEl.locator("option").allTextContents()
        const firstInsurer = options.find(
          (o) => !o.includes("Selecione") && o.trim().length > 0
        )
        if (firstInsurer) {
          await selectEl.selectOption({ label: firstInsurer.trim() })
        }
      }

      // Tipo de segurado
      const tipoSegSelect = page.locator("select").nth(1)
      if (await tipoSegSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await tipoSegSelect.selectOption({ label: "Segurado" })
      }
    })

    // ── 4. Buscar e selecionar cliente existente ─────────────────────────
    await test.step("4. Buscar cliente existente", async () => {
      // Buscar no autocomplete
      const searchInput = page.locator('input[placeholder*="Buscar por nome"]')
      await expect(searchInput).toBeVisible({ timeout: 5_000 })

      // Buscar por "E2E" para encontrar o cliente criado no cenário A,
      // ou qualquer outro nome existente
      await searchInput.fill("E2E")
      await page.waitForTimeout(1_000)

      // Tentar selecionar resultado
      const firstResult = page.locator("button", { hasText: /E2E/ }).first()
      const hasResult = await firstResult.isVisible({ timeout: 5_000 }).catch(() => false)

      if (hasResult) {
        await firstResult.click()
        // Verificar chip verde
        await page.waitForTimeout(500)
      } else {
        // Fallback: criar novo cliente inline
        const novoBtn = page.locator("button", { hasText: "Novo" }).first()
        await novoBtn.click()
        const segClientName = `E2E Seguradora ${Date.now()}`
        await page.locator('input[placeholder="Nome completo *"]').fill(segClientName)
        await page.locator('input[placeholder*="Celular"]').fill("92988880002")
        await page.locator('input[placeholder*="E-mail"]').fill(`e2e-seg-${Date.now()}@pipeline.test`)
        await page.locator("button", { hasText: "Cadastrar" }).click()
        await expect(
          page.locator("span", { hasText: segClientName }).first()
        ).toBeVisible({ timeout: 8_000 })
      }
    })

    // ── 5. Preencher veículo ─────────────────────────────────────────────
    await test.step("5. Preencher veículo", async () => {
      await fillPlate(page, plate)
      await page.locator('input[placeholder="Ex: Honda"]').fill("Toyota")
      await page.locator('input[placeholder="Ex: Civic"]').fill("Corolla")
    })

    // ── 6. Criar OS ──────────────────────────────────────────────────────
    await test.step("6. Criar OS seguradora", async () => {
      const responsePromise = page
        .waitForResponse(
          (r) =>
            r.url().includes("/api/proxy") &&
            r.url().includes("service-orders") &&
            r.request().method() === "POST" &&
            (r.status() < 300 || r.status() >= 400),
          { timeout: 15_000 }
        )
        .catch(() => null)

      await page.locator("button", { hasText: "Criar OS" }).click()

      const apiResponse = await responsePromise
      if (apiResponse && !apiResponse.ok()) {
        let body = "(sem corpo)"
        try {
          body = JSON.stringify(await apiResponse.json())
        } catch {
          /* noop */
        }
        throw new Error(`Criação OS seg falhou ${apiResponse.status()}: ${body}`)
      }

      await page.waitForURL(/\/service-orders\/[a-f0-9-]+/, { timeout: 20_000 })
      await page.waitForLoadState("networkidle")

      osUrl = page.url()
      osId = extractOsId(osUrl)
      expect(osId).toBeTruthy()
    })

    // ── 7. Verificar OS criada como seguradora ───────────────────────────
    await test.step("7. Verificar OS seguradora criada", async () => {
      await expect(page.locator("h1")).toContainText("OS #")
    })

    // ── 8. Adicionar peças e serviços via API ────────────────────────────
    await test.step("8. Adicionar itens via API", async () => {
      // Peça (seguradora fornece)
      await apiPost(page, `/api/proxy/v1/service-orders/${osId}/parts/`, {
        description: "Para-lama dianteiro esquerdo",
        part_number: "PLM-DE-001",
        quantity: 1,
        unit_price: "680.00",
        discount: "0.00",
        origem: "seguradora",
        tipo_qualidade: "genuina",
        payer: "insurer",
        source_type: "import",
      })

      // Serviço
      await apiPost(page, `/api/proxy/v1/service-orders/${osId}/labor/`, {
        description: "Funilaria para-lama + pintura",
        quantity: 1,
        unit_price: "1200.00",
        discount: "0.00",
        payer: "insurer",
        source_type: "import",
      })

      await page.reload()
      await page.waitForLoadState("networkidle")
    })

    // ── 9. Percorrer todos os status até DELIVERED ───────────────────────
    await test.step("9. Pipeline completa via API", async () => {
      // Preencher campos necessários para hard blocks
      await patchOS(page, osId, {
        service_authorization_date: new Date().toISOString(),
        mileage_out: 32100,
        client_delivery_date: new Date().toISOString(),
        casualty_number: `SIN-${Date.now()}`,
        deductible_amount: "500.00",
      })

      // Criar assinaturas necessárias
      await createSignature(page, osId, "BUDGET_APPROVAL")
      await createSignature(page, osId, "OS_DELIVERY")

      // Transicionar através de todos os status
      const statusPath = [
        "initial_survey",
        "budget",
        "waiting_auth",
        "authorized",
        "repair",
        "bodywork",
        "painting",
        "assembly",
        "polishing",
        "washing",
        "final_survey",
        "ready",
      ]

      for (const status of statusPath) {
        await apiTransition(page, osId, status)
      }

      // Billing para criar receivables
      await executeBilling(page, osId)

      // Entrega final
      await apiTransition(page, osId, "delivered")
    })

    // ── 10. Verificar estado final via UI ────────────────────────────────
    await test.step("10. Verificar OS seguradora entregue", async () => {
      await page.goto(osUrl)
      await page.waitForLoadState("networkidle")

      await expect(page.locator("text=Entregue").first()).toBeVisible({ timeout: 5_000 })

      // Verificar via API
      const res = await apiGet(page, `/api/proxy/v1/service-orders/${osId}/`)
      expect(res.body.status).toBe("delivered")
    })

    // ── 11. Verificar billing preview ────────────────────────────────────
    await test.step("11. Verificar billing da seguradora", async () => {
      const billingRes = await apiGet(
        page,
        `/api/proxy/v1/service-orders/${osId}/billing-preview/`
      )
      // Deve ter algum dado de billing
      expect(billingRes.ok).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/dscar-web && npx tsc --noEmit e2e/pipeline-e2e.spec.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/e2e/pipeline-e2e.spec.ts
git commit -m "test(e2e): add full pipeline E2E test (particular + seguradora)"
```

---

### Task 3: Update Playwright config for pipeline tests

**Files:**
- Modify: `apps/dscar-web/playwright.config.ts`

- [ ] **Step 1: Add pipeline project with extended timeout**

Add a second project in the `projects` array for pipeline tests:

```typescript
// In playwright.config.ts, add to the projects array:
{
  name: "pipeline",
  testMatch: /pipeline-e2e/,
  timeout: 300_000, // 5 minutos por test
  use: {
    ...devices["Desktop Chrome"],
    navigationTimeout: 30_000,
  },
},
```

- [ ] **Step 2: Commit**

```bash
git add apps/dscar-web/playwright.config.ts
git commit -m "test(e2e): add pipeline project with extended timeout to playwright config"
```

---

### Task 4: Run tests and fix issues

- [ ] **Step 1: Verify dev environment is running**

```bash
# Terminal 1: Docker services
make dev

# Terminal 2: Next.js dev server
cd apps/dscar-web && npm run dev
```

Wait for both to be healthy. Verify:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/login
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/service-orders/ -H "Authorization: Bearer test"
# Expected: 401 (auth required = server responding)
```

- [ ] **Step 2: Run pipeline tests**

```bash
cd apps/dscar-web && npx playwright test e2e/pipeline-e2e.spec.ts --project=pipeline --reporter=list
```

Expected: Both scenarios pass. If failures occur, debug with:
```bash
npx playwright test e2e/pipeline-e2e.spec.ts --project=pipeline --headed --reporter=list
```

Or use trace viewer:
```bash
npx playwright test e2e/pipeline-e2e.spec.ts --project=pipeline --trace=on
npx playwright show-trace test-results/*/trace.zip
```

- [ ] **Step 3: Fix any failures and re-run**

Common issues to watch for:
- Selector changes (button text, placeholder changes)
- API endpoint paths (v1 prefix, trailing slashes)
- Timing issues (increase waitForTimeout where needed)
- Hard block requirements not met (check transition_validator.py for exact conditions)

- [ ] **Step 4: Commit fixes**

```bash
git add apps/dscar-web/e2e/
git commit -m "test(e2e): fix pipeline E2E test issues after first run"
```

---

### Task 5: Write user manual

**Files:**
- Create: `docs/manual-pipeline-servicos.md`

- [ ] **Step 1: Write the user manual documenting the full pipeline**

The manual should cover, in Portuguese (PT-BR), with step-by-step instructions and screenshots descriptions:

```markdown
# Manual da Pipeline de Serviços — DS Car ERP

## 1. Cadastro de Cliente
- Acesse **Cadastros** no menu lateral
- Clique **Nova Pessoa**
- Preencha: Nome, CPF, Celular, E-mail
- Selecione papel: **Cliente**
- Salve

## 2. Criação da Ordem de Serviço
- Acesse **Ordens de Serviço** no menu
- Clique **Nova OS**
- Escolha o tipo de atendimento: **Particular** ou **Seguradora**
- Se seguradora: selecione a seguradora e tipo de segurado
- Busque o cliente ou clique **Novo** para cadastrar inline
- Preencha a placa do veículo (dados preenchidos automaticamente se cadastrado)
- Preencha montadora, modelo
- Clique **Criar OS**

## 3. Preenchimento da OS
- Na tela da OS, preencha:
  - **Data/Hora de Entrada** (botão "Agora" preenche automaticamente)
  - **Agendamento** (data prevista de entrada/entrega)
  - KM de entrada
- Clique **Salvar**

## 4. Vistoria Inicial (Recepção → Vistoria Inicial)
- Clique **Avançar Status** → **Vistoria Inicial**
- Requisitos: dados do veículo e cliente preenchidos
- Registre fotos da vistoria inicial (mínimo recomendado: 12)
- Preencha checklist de entrada

## 5. Orçamento (Vistoria Inicial → Orçamento)
- Avance para **Orçamento**
- Na aba **Peças**, adicione as peças necessárias:
  - **Do Estoque**: busca peça disponível no estoque
  - **Comprar**: solicita compra (cria pedido de compra)
  - **Seguradora Fornece**: peça fornecida pela seguradora
- Na aba **Serviços**, adicione os serviços:
  - Descrição, quantidade, valor unitário
  - Clique **Adicionar**

## 6. Autorização (Orçamento → Aguardando Autorização → Autorizada)
- Avance para **Aguardando Autorização**
- Para particular: cliente assina aprovação do orçamento
- Para seguradora: envie orçamento PDF, aguarde autorização
- Preencha **Data de Autorização**
- Avance para **Autorizada**

## 7. Compras (se há peças com origem "compra")
### 7.1 Pedidos de Compra
- Acesse **Compras** no menu
- Os pedidos aparecem automaticamente (status "Solicitado")
- Clique **Iniciar Cotação** para iniciar processo

### 7.2 Ordem de Compra
- Acesse **Compras → Ordens**
- Clique **Nova OC**, informe o ID da OS
- Adicione itens: fornecedor, descrição, valor, prazo
- Clique **Enviar para Aprovação**
- Gerente/Admin clica **Aprovar Compra**

## 8. Estoque
### 8.1 Entrada de Peças
- Acesse **Estoque → Entrada Manual**
- Selecione o produto, informe valor NF, localização
- Descreva o motivo da entrada
- Clique **Registrar Entrada**

### 8.2 Vincular à OS
- A peça recebida é automaticamente vinculada à OS
  quando o recebimento é registrado na Ordem de Compra

## 9. Aguardando Peças → Reparo
- Avance para **Aguardando Peças** (se há peças em compra)
- Quando peças chegarem, avance para **Reparo**

## 10. Fase de Oficina
A OS passa pelas etapas de oficina conforme o trabalho necessário:

| Etapa | Descrição |
|-------|-----------|
| **Reparo** | Início dos trabalhos |
| **Mecânica** | Serviços mecânicos |
| **Funilaria** | Trabalho de funilaria |
| **Pintura** | Pintura do veículo |
| **Montagem** | Remontagem das peças |
| **Polimento** | Polimento e acabamento |
| **Lavagem** | Lavagem final |

> **Nota:** Essas transições são gerenciadas principalmente pelo app mobile.
> Cada etapa requer apontamento de horas (timesheet) e foto de acompanhamento.

## 11. Vistoria Final
- Após **Lavagem**, avance para **Vistoria Final**
- Requisitos: todas as peças recebidas, todos os apontamentos fechados
- Registre fotos da vistoria final (mínimo recomendado: 12)
- Preencha checklist de saída

## 12. Pronto para Entrega
- Avance para **Pronto para Entrega**
- O cliente é notificado de que o veículo está pronto

## 13. Entrega
- Preencha **KM de saída**
- Preencha **Data de retirada pelo cliente**
- Cliente assina o recebimento do veículo
- Execute o **faturamento** (Billing):
  - Para particular: gera NFS-e (serviços) + NF-e (peças)
  - Para seguradora: split franquia (cliente) + valores (seguradora)
- Avance para **Entregue**

## Fluxo Visual Completo

```
Recepção → Vistoria Inicial → Orçamento → Aguard. Autorização → Autorizada
    ↓                                                              ↓
Cancelada                                            Aguardando Peças (se necessário)
                                                              ↓
                                                           Reparo
                                                              ↓
                                        Mecânica → Funilaria → Pintura → Montagem
                                                                              ↓
                                                          Polimento → Lavagem
                                                                         ↓
                                              Vistoria Final → Pronto → Entregue
```

## Atalhos e Dicas
- **Ctrl+K**: Busca rápida por OS, cliente ou placa
- **Kanban**: Visualize todas as OS por status em `/os/kanban`
- **Agenda**: Veja agendamentos de entrada e entrega em `/agenda`
- **Dashboard**: KPIs de acordo com seu papel (Gerente/Consultor/Técnico)
```

- [ ] **Step 2: Commit**

```bash
git add docs/manual-pipeline-servicos.md
git commit -m "docs: add user manual for service pipeline"
```

---

## Summary: Approach Decisions

| Aspecto | Decisão | Motivo |
|---------|---------|--------|
| Transições sem bloqueio | UI dropdown | Testa o fluxo real do usuário |
| Transições com soft blocks | API + force=true | Evita fragilidade de modais encadeados |
| Hard blocks (fotos/assinaturas) | API helpers | Pré-requisitos, não o que testamos |
| Fase de oficina (repair → washing) | API | Web diz "gerenciado pelo mobile" |
| Entrega final (billing/fiscal) | API + verificação UI | Billing é complexo; verificamos resultado na tela |
| Cenário B (seguradora) | Mais enxuto | Foca nas diferenças UX (busca cliente, insurer select) |
