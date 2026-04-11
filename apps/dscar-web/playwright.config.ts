/**
 * Paddock Solutions — Playwright Configuration
 * dscar-web / apps/dscar-web
 *
 * Documentação: https://playwright.dev/docs/test-configuration
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Diretório onde ficam os testes e2e
  testDir: "./e2e",

  // Timeout por teste (30 segundos — serviços Docker podem estar lentos)
  timeout: 30_000,

  // Timeout para assertions (expect)
  expect: {
    timeout: 10_000,
  },

  // Execução: falha rápida em CI, continua em dev local
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sequencial para não sobrepor sessões no dev server

  // Relatório: HTML em CI, lista no terminal em dev
  reporter: process.env.CI ? "html" : "list",

  // Configurações compartilhadas por todos os projetos
  use: {
    // URL base da aplicação dscar-web em dev
    baseURL: "http://localhost:3001",

    // Captura screenshot apenas em falha
    screenshot: "only-on-failure",

    // Gravar vídeo apenas em falha (CI)
    video: process.env.CI ? "retain-on-failure" : "off",

    // Trace para debugging de falhas em CI
    trace: process.env.CI ? "retain-on-failure" : "off",

    // Timeout de navegação
    navigationTimeout: 15_000,

    // Headers padrão — identifica o tenant DS Car no backend
    extraHTTPHeaders: {
      "X-Tenant-Domain": "dscar.localhost",
    },
  },

  // Projetos de browser
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // NÃO inicia o dev server automaticamente — requer `make dev` + `npm run dev`
  // Descomentar para iniciar automaticamente (útil em CI):
  //
  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3001",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
