import type React from "react"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"
import { FallbackResolver } from "./FallbackResolver"

export interface ResolverProps {
  block: ValidationBlock
  order: ServiceOrder
  onResolved: () => void
}

const REGISTRY = new Map<string, React.ComponentType<ResolverProps>>()

export function registerResolver(
  codes: readonly string[],
  component: React.ComponentType<ResolverProps>,
): void {
  for (const code of codes) REGISTRY.set(code, component)
}

export function getResolver(code: string): React.ComponentType<ResolverProps> {
  return REGISTRY.get(code) ?? FallbackResolver
}

export function hasResolverFor(code: string): boolean {
  return REGISTRY.has(code)
}
