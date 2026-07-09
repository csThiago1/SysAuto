"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(max-width: 767px)"

function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", cb)
  return () => mql.removeEventListener("change", cb)
}

/** true abaixo do breakpoint md (SSR-safe, false no servidor). */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
