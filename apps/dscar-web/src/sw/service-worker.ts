/// <reference lib="webworker" />
/**
 * Service worker do PWA — Serwist.
 *
 * Estratégias (spec 2026-06-22):
 * - Assets estáticos do Next: precache (defaultCache do Serwist).
 * - GETs da API via proxy: NetworkFirst com fallback de cache (10s timeout).
 * - Mutações (POST/PATCH/DELETE): nunca cacheia — rede sempre.
 */
import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { NetworkFirst, Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // GETs da API: rede primeiro, cache como rede de segurança offline
      matcher: ({ url, request }) =>
        url.pathname.startsWith("/api/proxy/") && request.method === "GET",
      handler: new NetworkFirst({
        cacheName: "api-get-cache",
        networkTimeoutSeconds: 10,
      }),
    },
    ...defaultCache,
  ],
})

serwist.addEventListeners()

// ── Web Push ────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return
  const data = event.data.json() as { title?: string; body?: string; url?: string }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "DS Car ERP", {
      body: data.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url ?? "/" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string })?.url ?? "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => "focus" in c)
      if (existing) {
        existing.navigate(url)
        return existing.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
