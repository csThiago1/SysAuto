# Wizard Sprint B — SignatureCanvas web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar `FallbackResolver` para os codes de assinatura `SIGNATURE_APPROVAL` e `CLIENT_SIGNATURE` no Wizard de Transição da web, via um resolver único data-driven e um `SignatureSheet` reusável. Novos codes futuros = 1 linha num mapa.

**Architecture:** Resolver único `SignatureResolver` consulta `signatureCodeMap` (code → `{documentType, label}`) para decidir o quê apresentar. Abre `SignatureSheet` (Sheet shadcn fullscreen com `react-signature-canvas` + form). `useSignatureCapture` faz POST `/signatures/capture/`. `useSignatureExists` consulta pré-existência via GET filtrado. Backend zero mudança.

**Tech Stack:** React 18, Next.js 15 (App Router), TypeScript strict, TanStack Query v5, shadcn/ui (Sheet, Button, Input), `react-signature-canvas@^1.0.6`, Vitest + Testing Library + userEvent.

**Spec:** [`docs/superpowers/specs/2026-06-19-signature-canvas-wizard-design.md`](../specs/2026-06-19-signature-canvas-wizard-design.md)

---

## Arquivos a criar/modificar

### Criar
- `apps/dscar-web/src/components/signatures/types.ts`
- `apps/dscar-web/src/components/signatures/signatureCodeMap.ts`
- `apps/dscar-web/src/components/signatures/SignatureCanvas.tsx`
- `apps/dscar-web/src/components/signatures/SignatureSheet.tsx`
- `apps/dscar-web/src/components/signatures/__tests__/signatureCodeMap.test.ts`
- `apps/dscar-web/src/components/signatures/__tests__/SignatureCanvas.test.tsx`
- `apps/dscar-web/src/components/signatures/__tests__/SignatureSheet.test.tsx`
- `apps/dscar-web/src/components/transition-wizard/resolvers/SignatureResolver.tsx`
- `apps/dscar-web/src/components/transition-wizard/resolvers/SignatureResolver.test.tsx`
- `apps/dscar-web/src/hooks/useSignatureCapture.ts`
- `apps/dscar-web/src/hooks/useSignatureExists.ts`
- `apps/dscar-web/src/hooks/useSignatureCapture.test.ts`
- `apps/dscar-web/src/hooks/useSignatureExists.test.ts`

### Modificar
- `apps/dscar-web/package.json` — add `react-signature-canvas` + types
- `apps/dscar-web/src/components/transition-wizard/resolvers/index.ts` — registrar `SignatureResolver`

---

## Task 0: Setup — instalar lib + criar worktree (opcional)

**Files:**
- Modify: `apps/dscar-web/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: (Opcional) Criar worktree isolado**

Se preferir trabalhar isolado:

```bash
git worktree add ../grupo-dscar-sprint-b -b feat/wizard-signature-canvas
cd ../grupo-dscar-sprint-b
```

Caso contrário, trabalhar no branch atual (criar branch novo): `git switch -c feat/wizard-signature-canvas`.

- [ ] **Step 2: Instalar `react-signature-canvas`**

```bash

npm install --workspace=dscar-web react-signature-canvas
npm install --save-dev --workspace=dscar-web @types/react-signature-canvas
```

- [ ] **Step 3: Verificar versão instalada**

Esperado em `apps/dscar-web/package.json`:
```json
"react-signature-canvas": "^1.0.6"
```

- [ ] **Step 4: Rodar typecheck para validar peer deps**

```bash
npm run typecheck --workspace=dscar-web
```

Esperado: PASS sem erros relacionados a `react-signature-canvas`.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/package.json package-lock.json
git commit -m "chore(dscar-web): adiciona react-signature-canvas para Sprint B"
```

---

## Task 1: `types.ts` — tipos compartilhados

**Files:**
- Create: `apps/dscar-web/src/components/signatures/types.ts`

- [ ] **Step 1: Criar arquivo de tipos**

```ts
// apps/dscar-web/src/components/signatures/types.ts
export type SignatureDocumentType =
  | "BUDGET_APPROVAL"
  | "OS_OPEN"
  | "OS_DELIVERY"
  | "COMPLEMENT_APPROVAL"
  | "INSURANCE_ACCEPTANCE"
  | "VISTORIA_ENTRADA"

export type SignatureMethod = "CANVAS_TABLET" | "REMOTE_LINK" | "SCAN_PDF"

export interface CapturePayload {
  service_order_id: number
  document_type: SignatureDocumentType
  signer_name: string
  signature_png_base64: string
  signer_cpf?: string
  notes?: string
}

export interface Signature {
  id: number
  document_type: SignatureDocumentType
  method: SignatureMethod
  signer_name: string
  signer_cpf: string | null
  signed_at: string
  signature_png_base64?: string
  signature_hash: string
}
```

- [ ] **Step 2: Rodar typecheck**

```bash
npm run typecheck --workspace=dscar-web
```

Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/dscar-web/src/components/signatures/types.ts
git commit -m "feat(signatures): tipos base — SignatureDocumentType, Signature, CapturePayload"
```

---

## Task 2: `signatureCodeMap.ts` — mapa code → config (TDD)

**Files:**
- Create: `apps/dscar-web/src/components/signatures/signatureCodeMap.ts`
- Test: `apps/dscar-web/src/components/signatures/__tests__/signatureCodeMap.test.ts`

- [ ] **Step 1: Escrever testes falhando**

```ts
// apps/dscar-web/src/components/signatures/__tests__/signatureCodeMap.test.ts
import { describe, it, expect } from "vitest"
import { SIGNATURE_CODE_MAP, getSignatureCodeConfig } from "../signatureCodeMap"

describe("signatureCodeMap", () => {
  it("mapeia SIGNATURE_APPROVAL para BUDGET_APPROVAL", () => {
    const cfg = getSignatureCodeConfig("SIGNATURE_APPROVAL")
    expect(cfg).toEqual({
      documentType: "BUDGET_APPROVAL",
      label: "Aprovação do orçamento",
    })
  })

  it("mapeia CLIENT_SIGNATURE para OS_DELIVERY", () => {
    const cfg = getSignatureCodeConfig("CLIENT_SIGNATURE")
    expect(cfg).toEqual({
      documentType: "OS_DELIVERY",
      label: "Entrega do veículo",
    })
  })

  it("retorna null para code desconhecido", () => {
    expect(getSignatureCodeConfig("BOGUS_CODE")).toBeNull()
  })

  it("SIGNATURE_CODE_MAP cobre os 2 codes do validator atual", () => {
    expect(Object.keys(SIGNATURE_CODE_MAP).sort()).toEqual(
      ["CLIENT_SIGNATURE", "SIGNATURE_APPROVAL"],
    )
  })
})
```

- [ ] **Step 2: Rodar testes (devem falhar — arquivo não existe)**

```bash
cd apps/dscar-web && npx vitest run src/components/signatures/__tests__/signatureCodeMap.test.ts
```

Esperado: FAIL com "Cannot find module".

- [ ] **Step 3: Implementar `signatureCodeMap.ts`**

```ts
// apps/dscar-web/src/components/signatures/signatureCodeMap.ts
import type { SignatureDocumentType } from "./types"

export interface SignatureCodeConfig {
  documentType: SignatureDocumentType
  label: string
}

export const SIGNATURE_CODE_MAP: Record<string, SignatureCodeConfig> = {
  SIGNATURE_APPROVAL: {
    documentType: "BUDGET_APPROVAL",
    label: "Aprovação do orçamento",
  },
  CLIENT_SIGNATURE: {
    documentType: "OS_DELIVERY",
    label: "Entrega do veículo",
  },
  // Futuros (descomentar quando o validator adicionar):
  // SIGNATURE_OPENING:    { documentType: "OS_OPEN",              label: "Abertura/recepção" },
  // SIGNATURE_INSURANCE:  { documentType: "INSURANCE_ACCEPTANCE", label: "Aceite da seguradora" },
  // SIGNATURE_COMPLEMENT: { documentType: "COMPLEMENT_APPROVAL",  label: "Aprovação de complemento" },
  // SIGNATURE_INSPECTION: { documentType: "VISTORIA_ENTRADA",     label: "Vistoria de entrada" },
}

export function getSignatureCodeConfig(code: string): SignatureCodeConfig | null {
  return SIGNATURE_CODE_MAP[code] ?? null
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd apps/dscar-web && npx vitest run src/components/signatures/__tests__/signatureCodeMap.test.ts
```

Esperado: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/signatures/signatureCodeMap.ts \
        apps/dscar-web/src/components/signatures/__tests__/signatureCodeMap.test.ts
git commit -m "feat(signatures): mapa data-driven code → documentType + label"
```

---

## Task 3: `useSignatureExists` — query de pré-existência (TDD)

**Files:**
- Create: `apps/dscar-web/src/hooks/useSignatureExists.ts`
- Test: `apps/dscar-web/src/hooks/useSignatureExists.test.ts`

- [ ] **Step 1: Escrever testes falhando**

```ts
// apps/dscar-web/src/hooks/useSignatureExists.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useSignatureExists } from "./useSignatureExists"

const apiFetchMock = vi.fn()
vi.mock("@/lib/api", () => ({ apiFetch: (...a: unknown[]) => apiFetchMock(...a) }))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe("useSignatureExists", () => {
  beforeEach(() => apiFetchMock.mockReset())

  it("retorna true quando count > 0", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 1, results: [] })
    const { result } = renderHook(
      () => useSignatureExists(42, "BUDGET_APPROVAL"),
      { wrapper: wrap() },
    )
    await waitFor(() => expect(result.current.data).toBe(true))
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/proxy/signatures/?service_order=42&document_type=BUDGET_APPROVAL&page_size=1",
    )
  })

  it("retorna false quando count === 0", async () => {
    apiFetchMock.mockResolvedValueOnce({ count: 0, results: [] })
    const { result } = renderHook(
      () => useSignatureExists(42, "OS_DELIVERY"),
      { wrapper: wrap() },
    )
    await waitFor(() => expect(result.current.data).toBe(false))
  })

  it("não dispara query quando serviceOrderId é 0/falsy", () => {
    const { result } = renderHook(
      () => useSignatureExists(0, "BUDGET_APPROVAL"),
      { wrapper: wrap() },
    )
    expect(result.current.fetchStatus).toBe("idle")
    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar testes (devem falhar)**

```bash
cd apps/dscar-web && npx vitest run src/hooks/useSignatureExists.test.ts
```

Esperado: FAIL com "Cannot find module './useSignatureExists'".

- [ ] **Step 3: Implementar o hook**

```ts
// apps/dscar-web/src/hooks/useSignatureExists.ts
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { SignatureDocumentType } from "@/components/signatures/types"

interface SignatureListResponse {
  count: number
  results: unknown[]
}

export const signatureKeys = {
  exists: (orderId: number, docType: SignatureDocumentType) =>
    ["signatures", orderId, docType, "exists"] as const,
}

export function useSignatureExists(
  serviceOrderId: number,
  documentType: SignatureDocumentType,
) {
  return useQuery({
    queryKey: signatureKeys.exists(serviceOrderId, documentType),
    queryFn: async () => {
      const data = await apiFetch<SignatureListResponse>(
        `/api/proxy/signatures/?service_order=${serviceOrderId}&document_type=${documentType}&page_size=1`,
      )
      return data.count > 0
    },
    enabled: Boolean(serviceOrderId),
    staleTime: 30_000,
  })
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd apps/dscar-web && npx vitest run src/hooks/useSignatureExists.test.ts
```

Esperado: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/hooks/useSignatureExists.ts \
        apps/dscar-web/src/hooks/useSignatureExists.test.ts
git commit -m "feat(signatures): useSignatureExists — query de pré-existência por document_type"
```

---

## Task 4: `useSignatureCapture` — mutation POST (TDD)

**Files:**
- Create: `apps/dscar-web/src/hooks/useSignatureCapture.ts`
- Test: `apps/dscar-web/src/hooks/useSignatureCapture.test.ts`

- [ ] **Step 1: Escrever testes falhando**

```ts
// apps/dscar-web/src/hooks/useSignatureCapture.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useSignatureCapture } from "./useSignatureCapture"
import type { CapturePayload, Signature } from "@/components/signatures/types"

const apiFetchMock = vi.fn()
vi.mock("@/lib/api", () => ({ apiFetch: (...a: unknown[]) => apiFetchMock(...a) }))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe("useSignatureCapture", () => {
  beforeEach(() => apiFetchMock.mockReset())

  it("faz POST /signatures/capture/ com method CANVAS_TABLET injetado", async () => {
    const signature: Signature = {
      id: 1,
      document_type: "BUDGET_APPROVAL",
      method: "CANVAS_TABLET",
      signer_name: "João",
      signer_cpf: null,
      signed_at: "2026-06-19T10:00:00Z",
      signature_hash: "abc",
    }
    apiFetchMock.mockResolvedValueOnce(signature)

    const { result } = renderHook(() => useSignatureCapture(), { wrapper: wrap() })

    const payload: CapturePayload = {
      service_order_id: 42,
      document_type: "BUDGET_APPROVAL",
      signer_name: "João",
      signature_png_base64: "iVBORw0KGgo=",
    }

    result.current.mutate(payload)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/proxy/signatures/capture/",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    )
    const sentBody = JSON.parse(apiFetchMock.mock.calls[0][1].body as string)
    expect(sentBody).toMatchObject({ ...payload, method: "CANVAS_TABLET" })
    expect(result.current.data).toEqual(signature)
  })
})
```

- [ ] **Step 2: Rodar testes (devem falhar)**

```bash
cd apps/dscar-web && npx vitest run src/hooks/useSignatureCapture.test.ts
```

Esperado: FAIL.

- [ ] **Step 3: Implementar o hook**

```ts
// apps/dscar-web/src/hooks/useSignatureCapture.ts
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
```

- [ ] **Step 4: Rodar testes**

```bash
cd apps/dscar-web && npx vitest run src/hooks/useSignatureCapture.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/hooks/useSignatureCapture.ts \
        apps/dscar-web/src/hooks/useSignatureCapture.test.ts
git commit -m "feat(signatures): useSignatureCapture — mutation POST com method injetado"
```

---

## Task 5: `SignatureCanvas` — wrapper react-signature-canvas (TDD)

**Files:**
- Create: `apps/dscar-web/src/components/signatures/SignatureCanvas.tsx`
- Test: `apps/dscar-web/src/components/signatures/__tests__/SignatureCanvas.test.tsx`

- [ ] **Step 1: Escrever testes falhando**

```tsx
// apps/dscar-web/src/components/signatures/__tests__/SignatureCanvas.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { createRef } from "react"
import { SignatureCanvas, type SignatureCanvasHandle } from "../SignatureCanvas"

// Mock react-signature-canvas — estado em memória + repassa onEnd
vi.mock("react-signature-canvas", () => {
  const React = require("react")
  let empty = true
  const Mock = React.forwardRef(
    (props: { onEnd?: () => void }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        clear: () => { empty = true },
        isEmpty: () => empty,
        toDataURL: () => "data:image/png;base64,FAKE",
      }))
      return (
        <button
          data-testid="sigpad"
          type="button"
          onClick={() => {
            empty = false
            props.onEnd?.()
          }}
        >
          stroke
        </button>
      )
    },
  )
  Mock.displayName = "SignaturePadMock"
  return { default: Mock }
})

describe("SignatureCanvas", () => {
  it("renderiza o canvas", () => {
    const { getByTestId } = render(<SignatureCanvas />)
    expect(getByTestId("sigpad")).toBeInTheDocument()
  })

  it("expõe imperative handle: isEmpty inicial = true", () => {
    const ref = createRef<SignatureCanvasHandle>()
    render(<SignatureCanvas ref={ref} />)
    expect(ref.current?.isEmpty()).toBe(true)
  })

  it("clear() reseta isEmpty para true após onEnd", async () => {
    const user = (await import("@testing-library/user-event")).default.setup()
    const ref = createRef<SignatureCanvasHandle>()
    const onEnd = vi.fn()
    const { getByTestId } = render(<SignatureCanvas ref={ref} onEnd={onEnd} />)
    await user.click(getByTestId("sigpad"))
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(ref.current?.isEmpty()).toBe(false)
    ref.current?.clear()
    expect(ref.current?.isEmpty()).toBe(true)
  })

  it("toPng() retorna base64 SEM prefixo data:", () => {
    const ref = createRef<SignatureCanvasHandle>()
    render(<SignatureCanvas ref={ref} />)
    expect(ref.current?.toPng()).toBe("FAKE")
  })
})
```

- [ ] **Step 2: Rodar testes (devem falhar)**

```bash
cd apps/dscar-web && npx vitest run src/components/signatures/__tests__/SignatureCanvas.test.tsx
```

Esperado: FAIL.

- [ ] **Step 3: Implementar o componente**

```tsx
// apps/dscar-web/src/components/signatures/SignatureCanvas.tsx
"use client"

import { forwardRef, useImperativeHandle, useRef } from "react"
import SignaturePad from "react-signature-canvas"

export interface SignatureCanvasHandle {
  clear: () => void
  isEmpty: () => boolean
  toPng: () => string
}

interface SignatureCanvasProps {
  className?: string
  penColor?: string
  backgroundColor?: string
  onEnd?: () => void  // chamado quando o usuário termina um trace
}

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  function SignatureCanvas(
    { className, penColor = "#0f172a", backgroundColor = "#ffffff", onEnd },
    ref,
  ) {
    const padRef = useRef<SignaturePad | null>(null)

    useImperativeHandle(ref, () => ({
      clear: () => padRef.current?.clear(),
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toPng: () => {
        const dataUrl = padRef.current?.toDataURL("image/png") ?? ""
        return dataUrl.replace(/^data:image\/png;base64,/, "")
      },
    }))

    return (
      <SignaturePad
        ref={padRef}
        penColor={penColor}
        backgroundColor={backgroundColor}
        onEnd={onEnd}
        canvasProps={{
          className: `w-full h-full rounded border border-input ${className ?? ""}`,
        }}
      />
    )
  },
)
```

- [ ] **Step 4: Rodar testes**

```bash
cd apps/dscar-web && npx vitest run src/components/signatures/__tests__/SignatureCanvas.test.tsx
```

Esperado: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/signatures/SignatureCanvas.tsx \
        apps/dscar-web/src/components/signatures/__tests__/SignatureCanvas.test.tsx
git commit -m "feat(signatures): SignatureCanvas — wrapper react-signature-canvas com imperative handle"
```

---

## Task 6: `SignatureSheet` — Sheet fullscreen + form + canvas (TDD)

**Files:**
- Create: `apps/dscar-web/src/components/signatures/SignatureSheet.tsx`
- Test: `apps/dscar-web/src/components/signatures/__tests__/SignatureSheet.test.tsx`

- [ ] **Step 1: Escrever os testes falhando**

```tsx
// apps/dscar-web/src/components/signatures/__tests__/SignatureSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SignatureSheet } from "../SignatureSheet"

const captureMutate = vi.fn()
const captureMock = vi.fn(() => ({
  mutateAsync: captureMutate,
  isPending: false,
  reset: vi.fn(),
}))
vi.mock("@/hooks/useSignatureCapture", () => ({
  useSignatureCapture: () => captureMock(),
}))

// Mock SignatureCanvas — repassa onEnd e expõe handle
vi.mock("../SignatureCanvas", () => {
  const React = require("react")
  let empty = true
  const Mock = React.forwardRef(
    (props: { onEnd?: () => void }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        clear: () => { empty = true },
        isEmpty: () => empty,
        toPng: () => "BASE64",
      }))
      return (
        <button
          data-testid="draw"
          type="button"
          onClick={() => { empty = false; props.onEnd?.() }}
        >
          draw
        </button>
      )
    },
  )
  Mock.displayName = "SignatureCanvasMock"
  return { SignatureCanvas: Mock }
})

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  serviceOrderId: 42,
  documentType: "BUDGET_APPROVAL" as const,
  title: "Aprovação do orçamento",
  defaultSignerName: "João Silva",
  defaultSignerCpf: "123.456.789-00",
  onCaptured: vi.fn(),
}

describe("SignatureSheet", () => {
  beforeEach(() => {
    captureMutate.mockReset()
    baseProps.onCaptured = vi.fn()
    baseProps.onOpenChange = vi.fn()
  })

  it("mostra title no header", () => {
    wrap(<SignatureSheet {...baseProps} />)
    expect(screen.getByText(/Aprovação do orçamento/i)).toBeInTheDocument()
  })

  it("pré-preenche nome e CPF", () => {
    wrap(<SignatureSheet {...baseProps} />)
    expect(screen.getByLabelText(/nome/i)).toHaveValue("João Silva")
    expect(screen.getByLabelText(/cpf/i)).toHaveValue("123.456.789-00")
  })

  it("Confirmar fica desabilitado com canvas vazio", () => {
    wrap(<SignatureSheet {...baseProps} />)
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled()
  })

  it("Confirmar fica desabilitado com nome < 3 chars", async () => {
    const user = userEvent.setup()
    wrap(<SignatureSheet {...baseProps} defaultSignerName="" />)
    await user.click(screen.getByTestId("draw"))
    await user.type(screen.getByLabelText(/nome/i), "Jo")
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeDisabled()
  })

  it("sucesso chama onCaptured e onOpenChange(false)", async () => {
    const user = userEvent.setup()
    const onCaptured = vi.fn()
    const onOpenChange = vi.fn()
    captureMutate.mockResolvedValueOnce({ id: 1, document_type: "BUDGET_APPROVAL" })

    wrap(<SignatureSheet {...baseProps} onCaptured={onCaptured} onOpenChange={onOpenChange} />)
    await user.click(screen.getByTestId("draw"))
    await user.click(screen.getByRole("button", { name: /confirmar/i }))

    await waitFor(() => expect(onCaptured).toHaveBeenCalledTimes(1))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(captureMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        service_order_id: 42,
        document_type: "BUDGET_APPROVAL",
        signer_name: "João Silva",
        signature_png_base64: "BASE64",
      }),
    )
  })

  it("erro de rede mostra toast e mantém Sheet aberto", async () => {
    const { toast } = await import("sonner")
    const user = userEvent.setup()
    captureMutate.mockRejectedValueOnce(new Error("network_error"))

    const onOpenChange = vi.fn()
    wrap(<SignatureSheet {...baseProps} onOpenChange={onOpenChange} />)
    await user.click(screen.getByTestId("draw"))
    await user.click(screen.getByRole("button", { name: /confirmar/i }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})
```

- [ ] **Step 2: Rodar testes (devem falhar)**

```bash
cd apps/dscar-web && npx vitest run src/components/signatures/__tests__/SignatureSheet.test.tsx
```

Esperado: FAIL.

- [ ] **Step 3: Implementar `SignatureSheet`**

```tsx
// apps/dscar-web/src/components/signatures/SignatureSheet.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSignatureCapture } from "@/hooks/useSignatureCapture"
import { SignatureCanvas, type SignatureCanvasHandle } from "./SignatureCanvas"
import type { Signature, SignatureDocumentType } from "./types"

interface SignatureSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceOrderId: number
  documentType: SignatureDocumentType
  title: string
  defaultSignerName?: string
  defaultSignerCpf?: string
  onCaptured?: (signature: Signature) => void
}

export function SignatureSheet({
  open,
  onOpenChange,
  serviceOrderId,
  documentType,
  title,
  defaultSignerName = "",
  defaultSignerCpf = "",
  onCaptured,
}: SignatureSheetProps) {
  const canvasRef = useRef<SignatureCanvasHandle>(null)
  const [signerName, setSignerName] = useState(defaultSignerName)
  const [signerCpf, setSignerCpf] = useState(defaultSignerCpf)
  const [, forceRender] = useState(0)
  const capture = useSignatureCapture()

  // Sincroniza state quando props default mudam (ex.: reabriu pra outro OS)
  useEffect(() => {
    if (open) {
      setSignerName(defaultSignerName)
      setSignerCpf(defaultSignerCpf)
    }
  }, [open, defaultSignerName, defaultSignerCpf])

  const nameOk = signerName.trim().length >= 3
  // Reavalia isEmpty via re-render manual disparado no canvas onEnd
  const canSubmit = nameOk && !(canvasRef.current?.isEmpty() ?? true) && !capture.isPending

  async function handleConfirm(): Promise<void> {
    if (!canvasRef.current) return
    if (canvasRef.current.isEmpty()) return
    try {
      const sig = await capture.mutateAsync({
        service_order_id: serviceOrderId,
        document_type: documentType,
        signer_name: signerName.trim(),
        signer_cpf: signerCpf.trim() || undefined,
        signature_png_base64: canvasRef.current.toPng(),
      })
      toast.success("Assinatura registrada.")
      onCaptured?.(sig)
      onOpenChange(false)
    } catch {
      toast.error("Erro ao salvar assinatura. Tente novamente.")
    }
  }

  function handleOpenChange(next: boolean): void {
    if (!next && !canvasRef.current?.isEmpty()) {
      const ok = window.confirm("Descartar assinatura?")
      if (!ok) return
    }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-screen sm:max-w-none h-screen flex flex-col gap-4"
      >
        <SheetHeader>
          <SheetTitle>Assinatura — {title}</SheetTitle>
          <SheetDescription>
            O cliente assina abaixo. Nome e CPF podem ser ajustados se necessário.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="signer_name">Nome de quem assina</Label>
            <Input
              id="signer_name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              minLength={3}
              required
            />
          </div>
          <div>
            <Label htmlFor="signer_cpf">CPF (opcional)</Label>
            <Input
              id="signer_cpf"
              value={signerCpf}
              onChange={(e) => setSignerCpf(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-[40vh]">
          <SignatureCanvas
            ref={canvasRef}
            className="bg-white"
            onEnd={() => forceRender((n) => n + 1)}
          />
        </div>

        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              canvasRef.current?.clear()
              forceRender((n) => n + 1)
            }}
          >
            Limpar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {capture.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd apps/dscar-web && npx vitest run src/components/signatures/__tests__/SignatureSheet.test.tsx
```

Esperado: PASS — 6 tests. Se algum teste falhar por timing (`waitFor`), revisar o mock de `useSignatureCapture` e o `forceRender`.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/signatures/SignatureSheet.tsx \
        apps/dscar-web/src/components/signatures/__tests__/SignatureSheet.test.tsx
git commit -m "feat(signatures): SignatureSheet — fullscreen Sheet com form + canvas + POST"
```

---

## Task 7: `SignatureResolver` — resolver único data-driven (TDD)

**Files:**
- Create: `apps/dscar-web/src/components/transition-wizard/resolvers/SignatureResolver.tsx`
- Test: `apps/dscar-web/src/components/transition-wizard/resolvers/SignatureResolver.test.tsx`

- [ ] **Step 1: Escrever testes falhando (cobrindo os 2 codes + fallback)**

```tsx
// apps/dscar-web/src/components/transition-wizard/resolvers/SignatureResolver.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SignatureResolver } from "./SignatureResolver"
import type { ServiceOrder, ValidationBlock } from "@paddock/types"

// Mock do hook de pré-existência — controlado por test
let existsState: { isLoading: boolean; data: boolean | undefined } = {
  isLoading: false,
  data: false,
}
vi.mock("@/hooks/useSignatureExists", () => ({
  useSignatureExists: () => existsState,
  signatureKeys: { exists: () => ["signatures"] },
}))

// Mock useCustomer — usado pra pré-fill de CPF; resolver tolera data=undefined
vi.mock("@/hooks/useCustomer", () => ({
  useCustomer: () => ({ data: undefined, isLoading: false }),
}))

// Mock do SignatureSheet — substitui pelo botão "captured" pra simular onCaptured
vi.mock("@/components/signatures/SignatureSheet", () => ({
  SignatureSheet: ({ open, onCaptured, title }: {
    open: boolean
    onCaptured?: () => void
    title: string
  }) =>
    open ? (
      <div data-testid="sheet" data-title={title}>
        <button onClick={() => onCaptured?.()}>fire-captured</button>
      </div>
    ) : null,
}))

const ORDER = {
  id: 42,
  customer_name: "João Silva",
  customer_uuid: null,
} as unknown as ServiceOrder

function wrap(ui: React.ReactElement) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

describe("SignatureResolver", () => {
  beforeEach(() => {
    existsState = { isLoading: false, data: false }
  })

  it.each([
    ["SIGNATURE_APPROVAL", "Aprovação do orçamento"],
    ["CLIENT_SIGNATURE", "Entrega do veículo"],
  ])("mostra botão com label correto para %s", (code, label) => {
    const block: ValidationBlock = { code, message: "x" }
    wrap(<SignatureResolver block={block} order={ORDER} onResolved={vi.fn()} />)
    expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument()
  })

  it("mostra estado de loading enquanto consulta pré-existência", () => {
    existsState = { isLoading: true, data: undefined }
    wrap(
      <SignatureResolver
        block={{ code: "SIGNATURE_APPROVAL", message: "x" }}
        order={ORDER}
        onResolved={vi.fn()}
      />,
    )
    expect(screen.getByText(/verificando/i)).toBeInTheDocument()
  })

  it("chama onResolved no mount quando assinatura já existe (sem mostrar botão)", async () => {
    existsState = { isLoading: false, data: true }
    const onResolved = vi.fn()
    wrap(
      <SignatureResolver
        block={{ code: "SIGNATURE_APPROVAL", message: "x" }}
        order={ORDER}
        onResolved={onResolved}
      />,
    )
    await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("button", { name: /coletar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/já capturada/i)).toBeInTheDocument()
  })

  it("clicar abre Sheet e onCaptured chama onResolved", async () => {
    const user = userEvent.setup()
    const onResolved = vi.fn()
    wrap(
      <SignatureResolver
        block={{ code: "SIGNATURE_APPROVAL", message: "x" }}
        order={ORDER}
        onResolved={onResolved}
      />,
    )
    await user.click(screen.getByRole("button", { name: /coletar/i }))
    expect(screen.getByTestId("sheet")).toHaveAttribute("data-title", "Aprovação do orçamento")
    await user.click(screen.getByRole("button", { name: /fire-captured/i }))
    expect(onResolved).toHaveBeenCalledTimes(1)
  })

  it("code desconhecido cai pro FallbackResolver", () => {
    const onResolved = vi.fn()
    wrap(
      <SignatureResolver
        block={{ code: "UNKNOWN_SIG_CODE", message: "Mensagem do fallback" }}
        order={ORDER}
        onResolved={onResolved}
      />,
    )
    expect(screen.getByText(/Mensagem do fallback/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar testes (devem falhar)**

```bash
cd apps/dscar-web && npx vitest run src/components/transition-wizard/resolvers/SignatureResolver.test.tsx
```

Esperado: FAIL.

- [ ] **Step 3: Implementar o resolver**

```tsx
// apps/dscar-web/src/components/transition-wizard/resolvers/SignatureResolver.tsx
"use client"

import { useEffect, useState } from "react"
import type { ServiceOrder } from "@paddock/types"
import { Button } from "@/components/ui/button"
import { SignatureSheet } from "@/components/signatures/SignatureSheet"
import {
  getSignatureCodeConfig,
  type SignatureCodeConfig,
} from "@/components/signatures/signatureCodeMap"
import { useSignatureExists } from "@/hooks/useSignatureExists"
import { useCustomer } from "@/hooks/useCustomer"
import { FallbackResolver } from "./FallbackResolver"
import type { ResolverProps } from "./index"

// Outer component: só decide qual variante renderizar. Sem hooks aqui pra não violar
// rules of hooks no early return pro Fallback.
export function SignatureResolver({ block, order, onResolved }: ResolverProps) {
  const config = getSignatureCodeConfig(block.code)
  if (!config) {
    return <FallbackResolver block={block} order={order} onResolved={onResolved} />
  }
  return (
    <KnownSignatureResolver config={config} order={order} onResolved={onResolved} />
  )
}

interface KnownProps {
  config: SignatureCodeConfig
  order: ServiceOrder
  onResolved: () => void
}

function KnownSignatureResolver({ config, order, onResolved }: KnownProps) {
  const [open, setOpen] = useState(false)
  const exists = useSignatureExists(order.id, config.documentType)
  const customer = useCustomer(order.customer_uuid ?? "")

  useEffect(() => {
    if (exists.data === true) onResolved()
  }, [exists.data, onResolved])

  if (exists.isLoading) {
    return <div className="text-sm text-muted-foreground">Verificando assinaturas…</div>
  }

  if (exists.data === true) {
    return <div className="text-sm text-success-600">✓ Assinatura já capturada</div>
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Coletar assinatura — {config.label}
      </Button>
      <SignatureSheet
        open={open}
        onOpenChange={setOpen}
        serviceOrderId={order.id}
        documentType={config.documentType}
        title={config.label}
        defaultSignerName={order.customer_name ?? ""}
        defaultSignerCpf={customer.data?.cpf_cnpj ?? ""}
        onCaptured={() => onResolved()}
      />
    </>
  )
}
```

- [ ] **Step 4: Rodar testes**

```bash
cd apps/dscar-web && npx vitest run src/components/transition-wizard/resolvers/SignatureResolver.test.tsx
```

Esperado: PASS — 5 cenários (2 parametrizados + 3 individuais).

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/transition-wizard/resolvers/SignatureResolver.tsx \
        apps/dscar-web/src/components/transition-wizard/resolvers/SignatureResolver.test.tsx
git commit -m "feat(wizard): SignatureResolver — resolver único data-driven via signatureCodeMap"
```

---

## Task 8: Registrar `SignatureResolver` no wizard

**Files:**
- Modify: `apps/dscar-web/src/components/transition-wizard/resolvers/index.ts`

- [ ] **Step 1: Aplicar a modificação**

No final do arquivo, após o último `registerResolver` da Fase 4, adicionar:

```ts
// Cabeçalho de imports — adicionar:
import { SignatureResolver } from "./SignatureResolver"
import { SIGNATURE_CODE_MAP } from "@/components/signatures/signatureCodeMap"

// ... resto dos registros existentes ...

// Sprint B — Signature (data-driven: todos os codes do mapa apontam pro mesmo resolver)
registerResolver(Object.keys(SIGNATURE_CODE_MAP), SignatureResolver)
```

Arquivo final esperado (trecho relevante):

```ts
import type React from "react"
import type { ValidationBlock, ServiceOrder } from "@paddock/types"
import { FallbackResolver } from "./FallbackResolver"
import { DataResolver } from "./DataResolver"
import { PhotoResolver } from "./PhotoResolver"
import { InsurerResolver } from "./InsurerResolver"
import { FileResolver } from "./FileResolver"
import { CancelJustificationResolver } from "./CancelJustificationResolver"
import { SignatureResolver } from "./SignatureResolver"
import { SIGNATURE_CODE_MAP } from "@/components/signatures/signatureCodeMap"

// ... export interface ResolverProps, REGISTRY, registerResolver, getResolver, hasResolverFor ...
// ... registros Fase 2 e Fase 4 (não alterar) ...

// Sprint B — Signature
registerResolver(Object.keys(SIGNATURE_CODE_MAP), SignatureResolver)
```

- [ ] **Step 2: Validar typecheck**

```bash
npm run typecheck --workspace=dscar-web
```

Esperado: PASS.

- [ ] **Step 3: Rodar a suíte completa do wizard**

```bash
cd apps/dscar-web && npx vitest run src/components/transition-wizard
```

Esperado: PASS — todos os testes da Fase 2 e 4 continuam verdes + novos.

- [ ] **Step 4: Commit**

```bash
git add apps/dscar-web/src/components/transition-wizard/resolvers/index.ts
git commit -m "feat(wizard): registra SignatureResolver para SIGNATURE_APPROVAL + CLIENT_SIGNATURE"
```

---

## Task 9: Smoke manual no browser

- [ ] **Step 1: Subir stack local**

```bash
make dev
```

Verificar:
- Django responde em `http://localhost:8000/api/v1/`
- Next.js responde em `http://localhost:3001` (ou porta padrão do dscar-web)

- [ ] **Step 2: Cenário 1 — `SIGNATURE_APPROVAL` (orçamento particular)**

1. Logar como ADMIN ou CONSULTANT.
2. Abrir/criar OS particular (`customer_type="private"`) em status `waiting_auth`.
3. Acionar transição para `authorized`.
4. Wizard abre. Item `SIGNATURE_APPROVAL` mostra botão **"Coletar assinatura — Aprovação do orçamento"**.
5. Clicar → Sheet fullscreen abre com header "Assinatura — Aprovação do orçamento".
6. Verificar campo Nome pré-preenchido com `customer_name` da OS.
7. Verificar campo CPF (se cliente tem `customer_uuid` e cadastro com CPF, vem preenchido; senão vazio).
8. Tentar Confirmar com canvas vazio → botão desabilitado.
9. Desenhar no canvas → botão habilita.
10. Confirmar → toast "Assinatura registrada", Sheet fecha, item do wizard fica ✓ verde.
11. Clicar Avançar → OS muda para `authorized`.
12. Reabrir a OS em outro fluxo que precise validar → item nasce ✓ (pré-existência detectada via GET).

- [ ] **Step 3: Cenário 2 — `CLIENT_SIGNATURE` (entrega)**

1. Pegar OS em status `ready` (qualquer tipo de cliente).
2. Acionar transição para `delivered`.
3. Item `CLIENT_SIGNATURE` mostra botão **"Coletar assinatura — Entrega do veículo"**.
4. Repetir passos 5-11 acima com `documentType=OS_DELIVERY`.

- [ ] **Step 4: Edge cases**

- Fechar Sheet com canvas não-vazio → confirm "Descartar assinatura?" aparece.
- Desligar rede e tentar Confirmar → toast de erro, canvas preservado.
- Rotacionar tablet (DevTools → toggle device, mudar orientação) → canvas reseta (esperado da lib).

- [ ] **Step 5: Commit das anotações (se houver ajustes)**

Se durante o smoke aparecer ajuste menor (ex.: mensagem de toast, label):

```bash
git add ...
git commit -m "fix(signatures): <ajuste específico>"
```

---

## Task 10: Abrir PR

- [ ] **Step 1: Push do branch**

```bash
git push -u origin feat/wizard-signature-canvas
```

- [ ] **Step 2: Criar PR via gh**

```bash
gh pr create --title "feat(wizard): Sprint B — SignatureCanvas web + resolver assinatura data-driven" --body "$(cat <<'EOF'
## Summary
- Adiciona resolver único `SignatureResolver` data-driven via `signatureCodeMap.ts` (1 linha por code novo).
- Cobre `SIGNATURE_APPROVAL` (orçamento particular) e `CLIENT_SIGNATURE` (entrega) hoje. Pronto pra `OS_OPEN`, `INSURANCE_ACCEPTANCE`, `COMPLEMENT_APPROVAL`, `VISTORIA_ENTRADA` sem novo arquivo no futuro.
- `SignatureSheet` (Sheet shadcn fullscreen + `react-signature-canvas`) faz POST `/signatures/capture/`. Pré-existência detectada via GET filtrado por `service_order` + `document_type`.

## Test plan
- [ ] `cd apps/dscar-web && npx vitest run` — todos os novos testes passam (≥ 90% cobertura nos arquivos novos).
- [ ] `npm run typecheck --workspace=dscar-web` — sem erros.
- [ ] Smoke OS particular em `waiting_auth → authorized`: cliente assina, status muda.
- [ ] Smoke OS `ready → delivered`: cliente assina entrega, status muda.
- [ ] Pré-existência: reabrir OS já assinada → item nasce ✓.
- [ ] Edge: fechar Sheet com canvas não-vazio pede confirmação; erro de rede preserva canvas.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Critérios de aceite global

- [ ] `SIGNATURE_APPROVAL` e `CLIENT_SIGNATURE` NÃO mostram mais `FallbackResolver`.
- [ ] `cd apps/dscar-web && npx vitest run` verde, com ≥ 90% cobertura nos arquivos novos.
- [ ] `npm run typecheck --workspace=dscar-web` verde.
- [ ] Sem regressão nos testes existentes do wizard (Fase 2 + 4).
- [ ] Adicionar um novo code (ex.: `SIGNATURE_INSURANCE`) é literalmente uma linha em `signatureCodeMap.ts` — verificável por inspeção visual do diff hipotético.
