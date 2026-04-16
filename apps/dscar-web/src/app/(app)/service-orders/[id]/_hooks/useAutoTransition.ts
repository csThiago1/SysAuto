"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import type { ServiceOrder, ServiceOrderStatus } from "@paddock/types"

// Campos que disparam transições automáticas quando preenchidos
const AUTO_TRANSITION_FIELDS: Record<
  string,
  { validFrom: ServiceOrderStatus[]; target: ServiceOrderStatus; label: string }
> = {
  authorization_date: {
    validFrom: ["budget", "waiting_auth"],
    target: "authorized",
    label: "Autorizada",
  },
  scheduling_date: {
    validFrom: ["reception"],
    target: "initial_survey",
    label: "Vistoria Inicial",
  },
  final_survey_date: {
    validFrom: ["washing"],
    target: "final_survey",
    label: "Vistoria Final",
  },
  client_delivery_date: {
    validFrom: ["ready"],
    target: "delivered",
    label: "Entregue",
  },
}

interface UseAutoTransitionOptions {
  order: ServiceOrder | undefined
  onStatusChange?: (newStatus: ServiceOrderStatus) => void
}

/**
 * Hook que monitora campos de data no formulário e mostra feedback
 * quando uma transição automática é detectada (após save bem-sucedido).
 *
 * Compara o status da OS antes/depois de um update para detectar
 * se uma auto-transition ocorreu e exibir toast informativo.
 */
export function useAutoTransition({ order, onStatusChange }: UseAutoTransitionOptions) {
  const prevStatusRef = useRef<ServiceOrderStatus | undefined>(order?.status)

  useEffect(() => {
    if (!order) return

    const prevStatus = prevStatusRef.current
    const currentStatus = order.status

    if (prevStatus && prevStatus !== currentStatus) {
      // Verifica se a mudança foi uma auto-transition conhecida
      const autoEntry = Object.values(AUTO_TRANSITION_FIELDS).find(
        (cfg) => cfg.target === currentStatus && cfg.validFrom.includes(prevStatus)
      )

      if (autoEntry) {
        toast.success(`Status atualizado para "${autoEntry.label}"`, {
          description: "Transição automática detectada",
          duration: 4000,
        })
      }

      onStatusChange?.(currentStatus)
    }

    prevStatusRef.current = currentStatus
  }, [order?.status, onStatusChange])

  /**
   * Detecta se o valor de um campo, quando preenchido, causaria uma auto-transition
   * a partir do status atual. Usado para feedback otimista no frontend.
   */
  function predictTransition(
    field: string,
    newValue: string | null | undefined,
    currentStatus: ServiceOrderStatus
  ): ServiceOrderStatus | null {
    if (!newValue) return null
    const cfg = AUTO_TRANSITION_FIELDS[field]
    if (!cfg) return null
    if (cfg.validFrom.includes(currentStatus)) return cfg.target
    return null
  }

  return { predictTransition }
}
