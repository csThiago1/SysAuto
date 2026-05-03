/**
 * E2E — WMS Estoque (Smoke Tests)
 *
 * Verifica que todas as paginas do modulo WMS carregam sem erros:
 *  - Dashboard Estoque
 *  - Armazens
 *  - Produtos (Pecas / Insumos)
 *  - Movimentacoes
 *  - Contagens
 *  - Categorias
 *  - Entrada Manual
 *
 * Pre-requisitos:
 *   - make dev (todos os servicos Docker healthy)
 *   - cd apps/dscar-web && npm run dev (porta 3001)
 *   - npx playwright install (na primeira execucao)
 *
 * Execute via:
 *   cd apps/dscar-web && npx playwright test e2e/inventory-wms.spec.ts
 */

import { test, expect, type Page } from "@playwright/test"

// --- Helpers ----------------------------------------------------------------

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

// --- Tests ------------------------------------------------------------------

test.describe("WMS Estoque", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("dashboard carrega sem erros", async ({ page }) => {
    await page.goto("/estoque")
    await expect(page.locator("h1")).toContainText("Estoque")
    await expect(page.locator("text=SUBMÓDULOS")).toBeVisible({ timeout: 10_000 })
  })

  test("armazéns carrega lista", async ({ page }) => {
    await page.goto("/estoque/armazens")
    await expect(page.locator("h1")).toContainText("Armazéns")
  })

  test("produtos peças carrega lista", async ({ page }) => {
    await page.goto("/estoque/produtos/pecas")
    await expect(page.locator("h1")).toContainText("Peças")
  })

  test("produtos insumos carrega lista", async ({ page }) => {
    await page.goto("/estoque/produtos/insumos")
    await expect(page.locator("h1")).toContainText("Insumos")
  })

  test("movimentações carrega lista", async ({ page }) => {
    await page.goto("/estoque/movimentacoes")
    await expect(page.locator("h1")).toContainText("Movimentações")
  })

  test("contagens carrega lista", async ({ page }) => {
    await page.goto("/estoque/contagens")
    await expect(page.locator("h1")).toContainText("Contagens")
  })

  test("categorias carrega com tabs", async ({ page }) => {
    await page.goto("/estoque/categorias")
    await expect(page.getByRole("button", { name: "Tipos de Peça" })).toBeVisible({ timeout: 10_000 })
  })

  test("entrada manual carrega formulário", async ({ page }) => {
    await page.goto("/estoque/entrada")
    await expect(page.locator("h1")).toContainText("Entrada Manual")
  })
})
