"use client"

/**
 * Cliente Web Push — subscribe/unsubscribe no service worker + registro
 * no backend. iOS: só funciona com o app instalado como PWA (16.4+).
 */
import { apiFetch } from "@/lib/api"

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buffer
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export async function subscribeToPush(deviceId?: string): Promise<boolean> {
  if (!pushSupported()) return false
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapid) return false

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(vapid),
  })

  const json = subscription.toJSON()
  await apiFetch("/api/proxy/notifications/subscribe/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      device_id: deviceId ?? "",
    }),
  })
  return true
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await apiFetch("/api/proxy/notifications/subscribe/", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  await subscription.unsubscribe()
}
