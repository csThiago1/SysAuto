/**
 * Paddock Solutions — E2E Auth Flow
 * ==================================
 *
 * Testa fluxos de autenticacao:
 *   1. Login com credenciais validas redireciona para /os
 *   2. Senha errada exibe mensagem de erro
 *   3. Acesso sem autenticacao redireciona para /login
 *
 * Pre-requisitos:
 *   - make dev (todos os servicos Docker healthy)
 *   - cd apps/dscar-web && npm run dev (porta 3001)
 *   - npx playwright install (na primeira execucao)
 *
 * Execute via:
 *   cd apps/dscar-web && npx playwright test e2e/auth.spec.ts --headed
 */

import { test, expect } from "@playwright/test"
import { DEV_EMAIL, DEV_PASSWORD } from "./helpers"

test.describe("Auth flows", () => {
  test("login with valid credentials redirects to /os", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("domcontentloaded")

    await page.locator('input[type="email"]').fill(DEV_EMAIL)
    await page.locator('input[type="password"]').fill(DEV_PASSWORD)
    await page.locator('button[type="submit"]').click()

    await page.waitForURL("**/os", { timeout: 15_000 })
    await expect(page).toHaveURL(/\/os/)
  })

  test("wrong password shows error message", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("domcontentloaded")

    await page.locator('input[type="email"]').fill(DEV_EMAIL)
    await page.locator('input[type="password"]').fill("wrongpassword")
    await page.locator('button[type="submit"]').click()

    // Login page shows "E-mail ou senha incorretos."
    await expect(page.locator("text=incorretos")).toBeVisible({ timeout: 10_000 })
  })

  test("unauthenticated user redirected to /login", async ({ page }) => {
    // Access protected route without session
    await page.goto("/os")

    // Middleware redirects to /login
    await expect(page).toHaveURL(/\/login/)
  })
})
