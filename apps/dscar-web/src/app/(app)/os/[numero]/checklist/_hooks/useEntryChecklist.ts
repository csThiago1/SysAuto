"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { BodyType } from "@paddock/car-3d"
import { z } from "zod"

import { apiFetch, type ApiInit } from "@/lib/api"

import {
  BudgetPanelRuleSchema,
  ChecklistDamageSchema,
  ChecklistHistoryEntrySchema,
  CustomerBelongingSchema,
  EntryChecklistStateSchema,
  MatchSummarySchema,
  PdfUrlSchema,
  RemoteLinkSchema,
  type ChecklistDamage,
  type CustomerBelonging,
  type EntryChecklistState,
} from "../_schemas/checklist.schema"

const API = "/api/proxy"
const os = (osId: string) => `${API}/service-orders/${osId}`
const entry = (osId: string) => `${os(osId)}/checklist/entrada`

export const checklistKey = (osId: string) => ["checklist", osId] as const
export const damagesKey = (osId: string) => ["checklist-damages", osId] as const
export const belongingsKey = (osId: string) => ["belongings", osId] as const

async function get<T>(url: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  return schema.parse(await apiFetch<unknown>(url))
}

async function send<T>(
  url: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  body: unknown = {},
  init: ApiInit = {},
): Promise<T> {
  const method = init.method ?? "POST"
  const data = await apiFetch<unknown>(url, {
    ...init,
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return schema.parse(data)
}

// ─── Estado do checklist ─────────────────────────────────────────────────────

export function useEntryChecklist(osId: string) {
  return useQuery({
    queryKey: checklistKey(osId),
    queryFn: () => get(`${entry(osId)}/`, EntryChecklistStateSchema),
    enabled: !!osId,
  })
}

export type ChecklistPatch = {
  body_type?: BodyType
  stops_done?: Record<string, "done" | "sem_dano">
}

/** Grava o estado devolvido pelo servidor no cache do checklist. */
function useStateMutation<V>(osId: string, fn: (vars: V) => Promise<EntryChecklistState>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (state) => {
      qc.setQueryData(checklistKey(osId), state)
      // finalizar/reabrir mudam os requisitos de transição da OS
      void qc.invalidateQueries({ queryKey: ["service-orders", osId] })
    },
  })
}

export function usePatchChecklist(osId: string) {
  return useStateMutation(osId, (patch: ChecklistPatch) =>
    send(`${entry(osId)}/`, EntryChecklistStateSchema, patch, { method: "PATCH" }),
  )
}

export type FinalizePayload = {
  /** PNG base64 de cada ângulo do carro 3D, por câmera. */
  snapshots: Record<string, string>
  /** creditLine(resolveCarModel(...)); null para o modelo provisório. */
  model_credit: string | null
}

export function useFinalizeChecklist(osId: string) {
  return useStateMutation(osId, (payload: FinalizePayload) =>
    send(`${entry(osId)}/finalize/`, EntryChecklistStateSchema, payload, { offline: false }),
  )
}

export function useReopenChecklist(osId: string) {
  return useStateMutation(osId, (reason: string) =>
    send(`${entry(osId)}/reopen/`, EntryChecklistStateSchema, { reason }, { offline: false }),
  )
}

export type SignPayload = { signer_name: string; signature_png_base64: string }

export function useSignChecklist(osId: string) {
  return useStateMutation(osId, (payload: SignPayload) =>
    send(`${entry(osId)}/sign/`, EntryChecklistStateSchema, payload, { offline: false }),
  )
}

export function useSendRemoteLink(osId: string) {
  return useMutation({
    mutationFn: () => send(`${entry(osId)}/send-remote/`, RemoteLinkSchema, {}, { offline: false }),
  })
}

export function useChecklistHistory(osId: string) {
  return useQuery({
    queryKey: [...checklistKey(osId), "history"],
    queryFn: () => get(`${entry(osId)}/history/`, z.array(ChecklistHistoryEntrySchema)),
    enabled: !!osId,
  })
}

// ─── Danos ───────────────────────────────────────────────────────────────────

export type DamageInput = Pick<ChecklistDamage, "panel_key" | "damage_type" | "severity"> &
  Partial<Pick<ChecklistDamage, "relation" | "point" | "notes" | "photo_ids" | "client_uuid">> & {
    photo_client_uuids?: string[]
  }

export function useChecklistDamages(osId: string) {
  return useQuery({
    queryKey: damagesKey(osId),
    queryFn: () => get(`${os(osId)}/checklist-damages/`, z.array(ChecklistDamageSchema)),
    enabled: !!osId,
  })
}

function useDamageMutation<V>(osId: string, fn: (vars: V) => Promise<ChecklistDamage>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: damagesKey(osId) }),
  })
}

export function useCreateDamage(osId: string) {
  return useDamageMutation(osId, (input: DamageInput) =>
    send(`${os(osId)}/checklist-damages/`, ChecklistDamageSchema, input),
  )
}

export function usePatchDamage(osId: string) {
  return useDamageMutation(
    osId,
    ({ id, ...patch }: { id: string } & Partial<Omit<DamageInput, "client_uuid">>) =>
      send(`${os(osId)}/checklist-damages/${id}/`, ChecklistDamageSchema, patch, {
        method: "PATCH",
      }),
  )
}

/** Soft delete: o dano some da lista, mas continua no banco. */
export function useDeactivateDamage(osId: string) {
  return useDamageMutation(osId, (id: string) =>
    send(`${os(osId)}/checklist-damages/${id}/deactivate/`, ChecklistDamageSchema),
  )
}

export function useBudgetMatch(osId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => send(`${os(osId)}/checklist/budget-match/`, MatchSummarySchema),
    onSuccess: () => void qc.invalidateQueries({ queryKey: damagesKey(osId) }),
  })
}

export function useBudgetReport(osId: string) {
  return useMutation({
    mutationFn: () => send(`${os(osId)}/checklist/budget-match/report/`, PdfUrlSchema),
  })
}

export type PanelRuleInput = {
  pattern: string
  panel_keys: ChecklistDamage["panel_key"][]
  /** OS a recruzar depois de gravar a regra. */
  service_order_id?: string
}

export function useCreatePanelRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PanelRuleInput) =>
      send(`${API}/service-orders/checklist/panel-rules/`, BudgetPanelRuleSchema, input),
    onSuccess: (_rule, input) => {
      if (input.service_order_id) {
        void qc.invalidateQueries({ queryKey: damagesKey(input.service_order_id) })
      }
    },
  })
}

// ─── Pertences ───────────────────────────────────────────────────────────────

export type BelongingInput = Pick<CustomerBelonging, "description"> & {
  photo_id?: string | null
  photo_client_uuid?: string | null
  client_uuid?: string | null
}

export function useBelongings(osId: string) {
  return useQuery({
    queryKey: belongingsKey(osId),
    queryFn: () => get(`${os(osId)}/belongings/`, z.array(CustomerBelongingSchema)),
    enabled: !!osId,
  })
}

function useBelongingMutation<V>(osId: string, fn: (vars: V) => Promise<CustomerBelonging>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: belongingsKey(osId) }),
  })
}

export function useCreateBelonging(osId: string) {
  return useBelongingMutation(osId, (input: BelongingInput) =>
    send(`${os(osId)}/belongings/`, CustomerBelongingSchema, input),
  )
}

export function useReturnBelonging(osId: string) {
  return useBelongingMutation(osId, (id: string) =>
    send(`${os(osId)}/belongings/${id}/return/`, CustomerBelongingSchema),
  )
}
