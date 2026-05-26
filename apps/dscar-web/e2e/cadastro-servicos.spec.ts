/**
 * Paddock Solutions — E2E Cadastro Servicos
 * ===========================================
 *
 * Testa o CRUD basico da pagina de Servicos Canonicos:
 *   1. Pagina carrega com tabela
 *   2. Campo de busca funciona
 *
 * Pre-requisitos:
 *   - make dev (todos os servicos Docker healthy)
 *   - cd apps/dscar-web && npm run dev (porta 3001)
 *   - npx playwright install (na primeira execucao)
 *
 * Execute via:
 *   cd apps/dscar-web && npx playwright test e2e/cadastro-servicos.spec.ts --headed
 */

import { test, expect } from "@playwright/test"
import { login } from "./helpers"

test.describe("Cadastro Servicos", () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test("servicos page loads with table", async ({ page }) => {
    await page.goto("/cadastros/catalogo/servicos")
    await page.waitForLoadState("domcontentloaded")

    // Page title is visible
    await expect(page.locator("text=Canônicos")).toBeVisible({ timeout: 10_000 })

    // Either the table is visible or the empty state message
    const table = page.locator("table")
    const emptyState = page.locator("text=Nenhum serviço")
    await expect(table.or(emptyState)).toBeVisible({ timeout: 10_000 })
  })

  test("search input is present and functional", async ({ page }) => {
    await page.goto("/cadastros/catalogo/servicos")
    await page.waitForLoadState("domcontentloaded")

    // Search input should be visible
    const searchInput = page.locator('input[placeholder="Buscar serviço..."]')
    await expect(searchInput).toBeVisible({ timeout: 10_000 })

    // Type in search to verify it accepts input
    await searchInput.fill("pintura")
    await expect(searchInput).toHaveValue("pintura")
  })
})
