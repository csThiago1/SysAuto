import { useMutation } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { CapturePayload, Signature } from "@/components/signatures/types"

export function useSignatureCapture() {
  return useMutation({
    mutationFn: (payload: CapturePayload) =>
      apiFetch<Signature>("/api/proxy/signatures/capture/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, method: "CANVAS_TABLET" }),
      }),
  })
}
