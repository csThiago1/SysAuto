/**
 * E2E — Criação e edição de OS
 *
 * Fluxo testado:
 * 1. Login
 * 2. Abre drawer "Nova OS"
 * 3. Cria novo cliente inline (nome + CPF + telefone + email)
 * 4. Preenche placa (campo controlado com handlePlateChange), montadora, modelo
 * 5. Submete → navega para a OS criada
 * 6. Na tela de edição: salva sem erros de validação
 * 7. Usa botão "Agora" em campo datetime → salva sem erro de datetime
 */

import { test, expect, type Page } from "@playwright/test"

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  const emailInput = page.locator('input[type="email"], input[name="email"]')
  if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await emailInput.fill("thiago@paddock.solutions")
    await page.locator('input[type="password"]').fill("paddock123")
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/(os|service-orders|dashboard)/, { timeout: 15_000 })
  }
}

async function openNewOSDrawer(page: Page): Promise<boolean> {
  const btn = page.locator("button", { hasText: /^Nova OS$|^Nova Ordem/ }).first()
  if (!await btn.isVisible({ timeout: 5_000 }).catch(() => false)) return false
  await btn.click()
  await expect(page.locator("text=Nova Ordem de Serviço")).toBeVisible({ timeout: 5_000 })
  return true
}

// Campo de placa é controlado com setValue — usar page.evaluate para disparar
// o evento de forma que o React processe corretamente
async function fillPlate(page: Page, plate: string) {
  const plateInput = page.locator('input[placeholder="ABC1D23"]')
  await plateInput.click()
  await plateInput.evaluate(
    (el: HTMLInputElement, value: string) => {
      // Simula o evento change que o React escuta
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
      nativeInputValueSetter?.call(el, value)
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    },
    plate
  )
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

async function createClienteInline(page: Page, name: string) {
  await page.locator("button", { hasText: "Novo" }).first().click()
  await expect(page.locator("text=Novo cliente")).toBeVisible({ timeout: 3_000 })

  await page.locator('input[placeholder="Nome completo *"]').fill(name)
  await page.locator('input[placeholder="CPF * (11 dígitos)"]').fill("11144477735")
  await page.locator('input[placeholder="Telefone *"]').fill("92999990001")
  await page.locator('input[placeholder="E-mail *"]').fill("e2e@playwright.test")

  const cadastrarBtn = page.locator("button", { hasText: "Cadastrar" })
  await expect(cadastrarBtn).toBeEnabled({ timeout: 3_000 })
  await cadastrarBtn.click()

  // Chip verde do cliente selecionado
  await expect(page.locator("span", { hasText: name }).first())
    .toBeVisible({ timeout: 8_000 })
}

// Cria OS mínima e retorna a URL da OS criada
async function createMinimalOS(page: Page, opts: { plate: string; make: string; model: string }) {
  const opened = await openNewOSDrawer(page)
  expect(opened).toBe(true)

  const clientName = `E2E ${Date.now()}`
  await createClienteInline(page, clientName)

  await fillPlate(page, opts.plate)
  await page.locator('input[placeholder="Ex: Honda"]').fill(opts.make)
  await page.locator('input[placeholder="Ex: Civic"]').fill(opts.model)

  // Confirmar que a placa está válida (sem borda vermelha)
  const plateInput = page.locator('input[placeholder="ABC1D23"]')
  const plateVal = await plateInput.inputValue()
  expect(plateVal.length).toBeGreaterThanOrEqual(7)

  // Interceptar a resposta final da API (ignora 3xx redirects) antes de clicar
  const responsePromise = page.waitForResponse(
    (r) => {
      if (!r.url().includes("/api/proxy/service-orders") || r.request().method() !== "POST") return false
      return r.status() < 300 || r.status() >= 400  // skip 3xx redirects
    },
    { timeout: 15_000 }
  ).catch(() => null)

  await page.locator("button", { hasText: "Criar OS" }).click()

  // Aguardar resposta da API para diagnóstico
  const apiResponse = await responsePromise
  if (apiResponse && !apiResponse.ok()) {
    let respBody = "(sem corpo)"
    try { respBody = JSON.stringify(await apiResponse.json()) } catch { /* noop */ }
    const reqBody = apiResponse.request().postData() ?? "(sem body)"
    throw new Error(`API ${apiResponse.status()}: ${respBody} | enviado: ${reqBody.slice(0, 300)}`)
  }

  await page.waitForURL(/\/service-orders\/[a-f0-9-]+/, { timeout: 20_000 })
  await page.waitForLoadState("networkidle")

  return page.url()
}

// ─── Testes: Criação ──────────────────────────────────────────────────────────

test.describe("Nova OS — criação completa", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto("/service-orders")
    await page.waitForLoadState("networkidle")
  })

  test("cria nova OS particular com novo cliente e navega para tela de edição", async ({ page }) => {
    await createMinimalOS(page, { plate: "TST1234", make: "Toyota", model: "Corolla" })

    // Título mostra número da OS
    await expect(page.locator("h1")).toContainText("OS #")

    // Nenhum erro de validação deve aparecer ao abrir
    await expect(page.locator("text=Corrija os erros abaixo antes de salvar")).not.toBeVisible()
  })

  test("salva OS recém-criada sem erros de validação", async ({ page }) => {
    await createMinimalOS(page, { plate: "TST9876", make: "Honda", model: "Fit" })

    // Salvar sem modificar nada
    await page.locator("button", { hasText: "Salvar" }).click()
    await page.waitForTimeout(1500)

    const errorPanel = page.locator("text=Corrija os erros abaixo antes de salvar")
    if (await errorPanel.isVisible()) {
      const errors = await page.locator("ul li").allTextContents()
      throw new Error(`Erros ao salvar OS recém-criada: ${errors.join(" | ")}`)
    }

    await expect(page.locator("text=OS salva")).toBeVisible({ timeout: 8_000 })
  })

  test("preenche Data/Hora Entrada com botão Agora e salva sem erro de datetime", async ({ page }) => {
    await createMinimalOS(page, { plate: "TST5555", make: "VW", model: "Gol" })

    // Usar botão "Agora" no primeiro campo datetime visível (Data/Hora Entrada)
    const agoraButtons = page.locator("button", { hasText: "Agora" })
    await expect(agoraButtons.first()).toBeVisible({ timeout: 5_000 })
    // Usar evaluate para disparar o click direto no elemento sem interferência de sobreposição
    await agoraButtons.first().evaluate((btn) => (btn as HTMLButtonElement).click())
    await page.waitForTimeout(300)

    // Input deve ter valor no formato YYYY-MM-DDTHH:mm
    const dtInput = page.locator('input[type="datetime-local"]').first()
    await expect(dtInput).toHaveValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)

    // Salvar
    await page.locator("button", { hasText: "Salvar" }).click()
    await page.waitForTimeout(1500)

    // Não deve ter nenhum erro de Data/hora inválida
    await expect(page.locator("text=Data/hora inválida")).not.toBeVisible()

    const errorPanel = page.locator("text=Corrija os erros abaixo antes de salvar")
    if (await errorPanel.isVisible()) {
      const errors = await page.locator("ul li").allTextContents()
      const dtErrors = errors.filter((e) => e.includes("Data/hora") || e.includes("datetime"))
      if (dtErrors.length > 0) {
        throw new Error(`Erro de datetime após botão Agora: ${dtErrors.join(" | ")}`)
      }
    }

    await expect(page.locator("text=OS salva")).toBeVisible({ timeout: 8_000 })
  })
})

// ─── Testes: Edição ───────────────────────────────────────────────────────────

test.describe("Edição de OS — validação", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("lista carrega e rows são clicáveis", async ({ page }) => {
    await page.goto("/service-orders")
    await page.waitForLoadState("networkidle")
    await expect(page.locator("table")).toBeVisible()

    const firstRow = page.locator("tbody tr").first()
    if (await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstRow.click()
      await page.waitForURL(/\/service-orders\/[a-f0-9-]+/, { timeout: 10_000 })
      await expect(page.locator("h1")).toContainText("OS #")
    }
  })

  test("salvar OS existente não gera erros de validação indevidos", async ({ page }) => {
    await page.goto("/service-orders")
    await page.waitForLoadState("networkidle")

    const link = page.locator("tbody tr a[href*='/service-orders/']").first()
    if (!await link.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Sem OS existentes")
      return
    }
    await link.click()
    await page.waitForURL(/\/service-orders\/[a-f0-9-]+/, { timeout: 10_000 })
    await page.waitForLoadState("networkidle")

    await page.locator("button", { hasText: "Salvar" }).click()
    await page.waitForTimeout(1500)

    const errorPanel = page.locator("text=Corrija os erros abaixo antes de salvar")
    if (await errorPanel.isVisible()) {
      const errors = await page.locator("ul li").allTextContents()
      throw new Error(`Erros inesperados ao salvar sem modificar: ${errors.join(" | ")}`)
    }

    await expect(page.locator("text=OS salva")).toBeVisible({ timeout: 8_000 })
  })

  test("campos opcionais vazios não geram erros indevidos (NaN, empty string, enum vazio)", async ({ page }) => {
    await page.goto("/service-orders")
    await page.waitForLoadState("networkidle")

    const link = page.locator("tbody tr a[href*='/service-orders/']").first()
    if (!await link.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Sem OS existentes")
      return
    }
    await link.click()
    await page.waitForURL(/\/service-orders\/[a-f0-9-]+/, { timeout: 10_000 })
    await page.waitForLoadState("networkidle")

    await page.locator("button", { hasText: "Salvar" }).click()
    await page.waitForTimeout(1500)

    const forbidden = [
      "KM de entrada", "Ano do veículo", "Valor FIPE", "Dias de reparo",
      "Previsão de entrega", "Data/hora inválida", "os_type", "Invalid enum", "received nan",
    ]

    if (await page.locator("text=Corrija os erros abaixo antes de salvar").isVisible()) {
      const errors = await page.locator("ul li").allTextContents()
      const badErrors = errors.filter((e) => forbidden.some((f) => e.toLowerCase().includes(f.toLowerCase())))
      if (badErrors.length > 0) {
        throw new Error(`Campos opcionais com erros indevidos: ${badErrors.join(" | ")}`)
      }
    }
  })
})
