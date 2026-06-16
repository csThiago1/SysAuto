import { useState, useCallback } from "react"
import type { ValidationBlock } from "@paddock/types"

interface UseWizardReturn {
  resolvedCodes: Set<string>
  markResolved: (code: string) => void
  reset: () => void
  isAllBlockingResolved: (hardBlocks: ValidationBlock[], softBlocks: ValidationBlock[]) => boolean
}

export function useWizard(): UseWizardReturn {
  const [resolvedCodes, setResolvedCodes] = useState<Set<string>>(new Set())

  const markResolved = useCallback((code: string) => {
    setResolvedCodes((prev) => new Set([...prev, code]))
  }, [])

  const reset = useCallback(() => setResolvedCodes(new Set()), [])

  const isAllBlockingResolved = useCallback(
    (hardBlocks: ValidationBlock[], softBlocks: ValidationBlock[]): boolean => {
      const blocking = [...hardBlocks, ...softBlocks]
      if (blocking.length === 0) return true
      return blocking.every((b) => resolvedCodes.has(b.code))
    },
    [resolvedCodes]
  )

  return { resolvedCodes, markResolved, reset, isAllBlockingResolved }
}
