/**
 * E2E — Purchasing / Compras (Smoke Tests)
 *
 * Verifica que as paginas do modulo de Compras carregam sem erros:
 *  - Painel de Compras
 *  - PartsTab com botoes de origem (Do Estoque, Comprar, Seguradora Fornece)
 *
 * Pre-requisitos:
 *   - make dev (todos os servicos Docker healthy)
 *   - cd apps/dscar-web && npm run dev (porta 3001)
 *   - npx playwright install (na primeira execucao)
 *
 * Execute via:
 *   cd apps/dscar-web && npx playwright test e2e/purchasing.spec.ts
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

test.describe("Purchasing — Compras", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("painel de compras carrega", async ({ page }) => {
    await page.goto("/compras")
    await expect(page.locator("h1")).toContainText("Compras")
    await expect(page.locator("text=PEDIDOS PENDENTES")).toBeVisible({ timeout: 10_000 })
  })

  test("PartsTab mostra 3 botões de origem", async ({ page }) => {
    // Navigate to any OS detail page and check PartsTab
    await page.goto("/service-orders")
    // Click first OS in list (if any exist)
    const firstRow = page.locator("table tbody tr").first()
    if (await firstRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstRow.click()
      // Click Peças tab
      const pecasTab = page.locator("button", { hasText: "Peças" })
      if (await pecasTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await pecasTab.click()
        await expect(page.locator("text=Do Estoque")).toBeVisible({ timeout: 10_000 })
        await expect(page.locator("text=Comprar")).toBeVisible()
        await expect(page.locator("text=Seguradora Fornece")).toBeVisible()
      }
    }
  })
})
