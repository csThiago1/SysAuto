"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { BillingPreview, BillingPayload, BillingResult } from "@paddock/types"
import { apiFetch } from "@/lib/api"

const BASE = "/api/proxy/service-orders"

export function useBillingPreview(orderId: string) {
  return useQuery<BillingPreview>({
    queryKey: ["billing-preview", orderId],
    queryFn: () => apiFetch<BillingPreview>(`${BASE}/${orderId}/billing/preview`),
    enabled: !!orderId,
  })
}

export function useBillOS(orderId: string) {
  const qc = useQueryClient()
  return useMutation<BillingResult, Error, BillingPayload>({
    mutationFn: (payload) =>
      apiFetch<BillingResult>(`${BASE}/${orderId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      void qc.invalidateQueries({ queryKey: ["billing-preview", orderId] })
      void qc.invalidateQueries({ queryKey: ["service-order-history", orderId] })
    },
  })
}
