import { useSyncExternalStore } from "react"

const QUERY = "(min-width: 768px)" // breakpoint md do Tailwind

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

/** true em tela md+. No servidor (e no 1º render) é false: quem só existe no desktop espera. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  )
}
