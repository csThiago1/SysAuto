import type React from "react"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"

export interface ResolverProps {
  block: ValidationBlock
  order: ServiceOrder
  onResolved: (code: string) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REGISTRY: Record<string, React.ComponentType<ResolverProps>> = {}

export function registerResolver(
  codes: string[],
  component: React.ComponentType<ResolverProps>
): void {
  for (const code of codes) {
    REGISTRY[code] = component
  }
}

export function getResolver(code: string): React.ComponentType<ResolverProps> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FallbackResolver } = require("./FallbackResolver") as {
    FallbackResolver: React.ComponentType<ResolverProps>
  }
  return REGISTRY[code] ?? FallbackResolver
}
