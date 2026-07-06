/**
 * Fases agregadas do pipeline de OS para o stepper compacto do header v2.
 * 17 status → 5 fases visuais.
 */
import type { ServiceOrderStatus } from "@paddock/types"

export interface PipelinePhase {
  key: string
  label: string
  statuses: ServiceOrderStatus[]
}

export const PIPELINE_PHASES: PipelinePhase[] = [
  { key: "entrada", label: "Entrada", statuses: ["reception", "initial_survey", "budget"] },
  { key: "autorizacao", label: "Autorização", statuses: ["waiting_auth", "authorized", "waiting_parts"] },
  {
    key: "reparo",
    label: "Reparo",
    statuses: ["repair", "mechanic", "bodywork", "painting", "assembly", "polishing", "washing"],
  },
  { key: "finalizacao", label: "Finalização", statuses: ["final_survey", "ready"] },
  { key: "entrega", label: "Entrega", statuses: ["delivered"] },
]

/** Índice da fase atual (-1 se cancelada). */
export function currentPhaseIndex(status: ServiceOrderStatus): number {
  return PIPELINE_PHASES.findIndex((p) => p.statuses.includes(status))
}
