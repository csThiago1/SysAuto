# Wizard de Transição — Sprint B: SignatureCanvas web + `SIGNATURE_APPROVAL`

**Data:** 2026-06-19
**Autor:** Thiago Campos (brainstorm guiado com Claude Code)
**Status:** Spec aprovado, aguardando plano de implementação
**Predecessor:** Sprint A (Cloudflare R2 — entregue em `0a9f590`), Wizard Fase 4 (`docs/superpowers/plans/2026-06-17-transition-wizard-fase-4.md`)

---

## 1. Visão geral

### Contexto

O Wizard de Transição hoje resolve 18 codes inline (Fase 2 + Fase 4). O code `SIGNATURE_APPROVAL` continua mostrando o `FallbackResolver` por depender de um componente de canvas que não existe na web — só no mobile (`apps/mobile/src/components/ui/SignatureCanvas.tsx` via `react-native-signature-canvas`).

Esta Sprint B entrega o componente web e o resolver que consome ele, eliminando o `FallbackResolver` para `SIGNATURE_APPROVAL`. O backend já está pronto: `POST /signatures/capture/` aceita base64 PNG e cria o registro com hash SHA256 de integridade.

### Objetivo

Permitir que o consultor colete a assinatura do cliente particular direto do wizard ao avançar `waiting_auth → authorized`, sem sair pra outra tela.

### Fora de escopo

- Link público remoto pra cliente assinar sem login (campo `remote_token` no model existe mas o fluxo não — fica como sprint futura).
- Resolvers para outros document_types (`OS_DELIVERY`, `INSURANCE_ACCEPTANCE`, `VISTORIA_ENTRADA`, `COMPLEMENT_APPROVAL`) — o componente genérico fica pronto pra reuso, mas só `BUDGET_APPROVAL` é resolvido inline nesta sprint.
- Visualização/download de assinaturas existentes em outras telas.
- Migration de backend (zero risco em prod).

### Critérios de sucesso

1. `SIGNATURE_APPROVAL` deixa de mostrar `FallbackResolver` em OS particulares em `waiting_auth`.
2. Cliente assina no canvas do consultor (PC ou tablet em landscape) e o wizard avança.
3. Pré-existência de assinatura `BUDGET_APPROVAL` marca o item como ✓ automaticamente, sem mostrar canvas.
4. Componente `SignatureSheet` reusável: novos resolvers só importam e mudam `documentType`.
5. Cobertura de testes ≥ 90% nos novos arquivos (vitest + testing-library).
6. Sem regressão nos 18 resolvers existentes (Fase 2 + 4).

---

## 2. Decisões de brainstorm

| # | Decisão | Por quê |
|---|---|---|
| 1 | Cliente assina no balcão, no PC/tablet do consultor | Maior valor probatório; consultor opera o fluxo, cliente desenha. |
| 2 | Layout: Sheet shadcn fullscreen sobre o Dialog do wizard | Preserva estado do wizard, padrão shadcn nativo (focus trap, ESC), funciona em desktop e tablet. |
| 3 | Componente `SignatureSheet` genérico + resolver fino `SignatureApprovalResolver` | Reuso para futuros codes (`OS_DELIVERY` etc.) sem refactor. |
| 4 | Lib: `react-signature-canvas` | Wrapper React do `signature_pad` (paridade com mobile), bem mantida, exporta PNG via `toDataURL`. |
| 5 | Pré-existência marca ✓ automaticamente | UX limpa, sem decisão pro usuário; refazer assinatura sai do escopo. |
| 6 | Form coleta `signer_name` + `signer_cpf` pré-preenchidos do cadastro, editáveis | Robustez legal (CPF) + cobre caso de quem assina ser outra pessoa (esposa, filho). |
| 7 | Link público fora do escopo | Tem complexidade própria (token, página sem auth, expiração) — sprint dedicada futura. |

---

## 3. Arquitetura

### 3.1 Quatro camadas

```
WIZARD (existente)                            sem mudança no core
  └─ resolvers/index.ts                       registra SIGNATURE_APPROVAL → SignatureApprovalResolver
       │
       ▼
RESOLVER FINO (novo)                          SignatureApprovalResolver.tsx
  · botão "Coletar assinatura"
  · estado open do Sheet
  · mapeia code → documentType="BUDGET_APPROVAL"
  · detecta pré-existência no mount → onResolved() direto
  · ao receber Signature → setOpen(false) + onResolved()
       │
       ▼
COMPONENTE GENÉRICO (novo)                    components/signatures/ + hooks/
  · SignatureCanvas.tsx                       wrapper react-signature-canvas
  · SignatureSheet.tsx                        Sheet fullscreen + form + canvas
  · types.ts                                  SignatureDocumentType, Signature
  · useSignatureCapture.ts                    mutation POST /signatures/capture/
  · useSignatureExists.ts                     query GET /signatures/?service_order=…
       │
       ▼
BACKEND (existente)                           sem mudança
  · POST /signatures/capture/
  · GET /signatures/?service_order=X&document_type=BUDGET_APPROVAL  ← consulta pré-existência
```

### 3.2 Estrutura de arquivos

```
apps/dscar-web/src/
├── components/signatures/                    NOVO
│   ├── SignatureCanvas.tsx                   wrapper react-signature-canvas
│   ├── SignatureSheet.tsx                    Sheet fullscreen + form + canvas + POST
│   ├── types.ts                              SignatureDocumentType, Signature, payload
│   └── __tests__/
│       ├── SignatureCanvas.test.tsx
│       └── SignatureSheet.test.tsx
├── components/transition-wizard/resolvers/
│   ├── SignatureApprovalResolver.tsx         NOVO
│   ├── __tests__/
│   │   └── SignatureApprovalResolver.test.tsx
│   └── index.ts                              MODIFICADO — registra SIGNATURE_APPROVAL
└── hooks/
    ├── useSignatureCapture.ts                NOVO (paralelo ao mobile)
    ├── useSignatureExists.ts                 NOVO (consulta pré-existência)
    └── __tests__/
        ├── useSignatureCapture.test.ts
        └── useSignatureExists.test.ts
```

### 3.3 Dependência nova

- `react-signature-canvas@^1.0.6` (~12kB gzip) — instalar em `apps/dscar-web/package.json`.
- Types: `@types/react-signature-canvas` (dev dep).

---

## 4. Componentes detalhados

### 4.1 `SignatureCanvas.tsx`

Wrapper fino do `react-signature-canvas` que padroniza ref + API.

```tsx
import SignaturePad from "react-signature-canvas"

export interface SignatureCanvasHandle {
  clear: () => void
  isEmpty: () => boolean
  toPng: () => string  // base64 sem prefixo "data:image/png;base64,"
}

interface SignatureCanvasProps {
  className?: string
  penColor?: string         // default: #0f172a
  backgroundColor?: string  // default: #ffffff
}

export const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  function SignatureCanvas({ className, penColor = "#0f172a", backgroundColor = "#ffffff" }, ref) {
    const padRef = useRef<SignaturePad | null>(null)

    useImperativeHandle(ref, () => ({
      clear: () => padRef.current?.clear(),
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      toPng: () => {
        const dataUrl = padRef.current?.toDataURL("image/png") ?? ""
        return dataUrl.replace(/^data:image\/png;base64,/, "")
      },
    }))

    // ResizeObserver — limpa canvas se o container resize (rotação tablet)
    // react-signature-canvas perde traço; resolver mostra toast "Tela girada, refaça"

    return (
      <SignaturePad
        ref={padRef}
        penColor={penColor}
        backgroundColor={backgroundColor}
        canvasProps={{ className: `signature-canvas ${className ?? ""}` }}
      />
    )
  },
)
```

Responsabilidades:
- Encapsula a lib externa numa interface mínima e estável.
- Não conhece nada de negócio (signer, document_type, POST).
- Não controla form, botões, sheet, nada — só desenho.

### 4.2 `SignatureSheet.tsx`

Sheet shadcn fullscreen com form + canvas + ações. Faz o POST.

```tsx
interface SignatureSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceOrderId: number
  documentType: SignatureDocumentType   // "BUDGET_APPROVAL" para Sprint B
  defaultSignerName?: string
  defaultSignerCpf?: string
  onCaptured?: (signature: Signature) => void
}

// Layout interno:
// <Sheet side="right" full>   ← shadcn Sheet em modo fullscreen
//   <SheetHeader>Assinatura — <documentType label></SheetHeader>
//   <form>
//     <Input nome (required, min 3) />
//     <Input cpf (opcional, mascarado) />
//     <SignatureCanvas ref={canvasRef} className="h-[60vh]" />
//     <footer>
//       <Button variant="outline" onClick={() => canvasRef.current?.clear()}>Limpar</Button>
//       <Button onClick={handleConfirm} disabled={!canSubmit}>Confirmar</Button>
//     </footer>
//   </form>
// </Sheet>
```

Validações antes de habilitar Confirmar:
- `signer_name.trim().length >= 3`
- `canvasRef.current?.isEmpty() === false`

Fluxo do Confirmar:
1. `setSaving(true)`
2. `payload = { service_order_id, document_type, signer_name, signer_cpf: cpf || undefined, signature_png_base64: canvasRef.current.toPng(), method: "CANVAS_TABLET" }`
3. `await mutation.mutateAsync(payload)`
4. Sucesso → `qc.invalidateQueries(["service-orders", serviceOrderId])` + `qc.invalidateQueries(["service-orders"])` + `qc.invalidateQueries(["signatures", serviceOrderId])` → `onCaptured(signature)` → `onOpenChange(false)`.
5. Erro → `toast.error("Erro ao salvar assinatura. Tente novamente.")` + `setSaving(false)` (canvas preservado).

Fechar sem confirmar (X ou ESC):
- Se `!canvasRef.current?.isEmpty()` → `confirm("Descartar assinatura?")` (ConfirmDialog do projeto).
- Caso contrário → fecha direto.

### 4.3 `SignatureApprovalResolver.tsx`

Resolver fino que conecta wizard ao `SignatureSheet`.

```tsx
export function SignatureApprovalResolver({ order, onResolved }: ResolverProps) {
  const [open, setOpen] = useState(false)
  const { data: hasSignature, isLoading } = useSignatureExists(order.id, "BUDGET_APPROVAL")

  // Pré-existência — marca ✓ no mount
  useEffect(() => {
    if (hasSignature) onResolved()
  }, [hasSignature, onResolved])

  if (isLoading) return <div className="text-sm text-muted-foreground">Verificando assinaturas…</div>
  if (hasSignature) return <div className="text-sm text-success-600">✓ Assinatura já capturada</div>

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Coletar assinatura do cliente
      </Button>
      <SignatureSheet
        open={open}
        onOpenChange={setOpen}
        serviceOrderId={order.id}
        documentType="BUDGET_APPROVAL"
        defaultSignerName={order.customer?.name ?? ""}
        defaultSignerCpf={order.customer?.cpf_cnpj ?? ""}
        onCaptured={() => onResolved()}
      />
    </>
  )
}
```

Particularidades:
- `useSignatureExists` faz `GET /signatures/?service_order=X&document_type=BUDGET_APPROVAL&page_size=1` e retorna `data.results.length > 0`.
- Pré-fill do CPF tenta `order.customer?.cpf_cnpj` (campo unificado PF/PJ); fallback `""`.
- Não polui a UI do wizard com canvas — botão único, Sheet abre fullscreen.

### 4.4 `useSignatureCapture.ts`

Paralelo ao mobile, adaptado pra `apiFetch` (que vai pro proxy Next).

```ts
export function useSignatureCapture() {
  return useMutation({
    mutationFn: (payload: CapturePayload) =>
      apiFetch<Signature>("/api/proxy/signatures/capture/", {
        method: "POST",
        body: JSON.stringify({ ...payload, method: "CANVAS_TABLET" }),
        headers: { "Content-Type": "application/json" },
      }),
  })
}
```

### 4.5 `useSignatureExists.ts`

```ts
export function useSignatureExists(serviceOrderId: number, documentType: SignatureDocumentType) {
  return useQuery({
    queryKey: ["signatures", serviceOrderId, documentType],
    queryFn: async () => {
      const data = await apiFetch<{ count: number; results: Signature[] }>(
        `/api/proxy/signatures/?service_order=${serviceOrderId}&document_type=${documentType}&page_size=1`,
      )
      return data.count > 0
    },
    enabled: Boolean(serviceOrderId),
    staleTime: 30_000,
  })
}
```

### 4.6 Registro no wizard (modificado)

`apps/dscar-web/src/components/transition-wizard/resolvers/index.ts`:

```ts
import { SignatureApprovalResolver } from "./SignatureApprovalResolver"

// ... registros Fase 2 e 4 ...

// Sprint B — Signature
registerResolver(["SIGNATURE_APPROVAL"], SignatureApprovalResolver)
```

---

## 5. Data flow

### 5.1 Captura nova

1. Wizard renderiza item `SIGNATURE_APPROVAL` → busca resolver no REGISTRY → `SignatureApprovalResolver`.
2. Resolver consulta `useSignatureExists(order.id, "BUDGET_APPROVAL")`.
3. `hasSignature === false` → renderiza botão "Coletar assinatura do cliente".
4. Usuário clica → `setOpen(true)` → `SignatureSheet` abre fullscreen.
5. Form pré-preenchido com `order.customer.name` e `order.customer.cpf_cnpj`. Canvas em branco.
6. Cliente desenha (mouse, touch, ou stylus). Confirmar habilita quando nome ≥ 3 chars e canvas não-vazio.
7. Confirmar → `useSignatureCapture.mutateAsync(payload)`.
8. Backend cria `Signature` + retorna serializer com PNG base64.
9. Frontend invalida 3 queryKeys: `["service-orders", id]`, `["service-orders"]`, `["signatures", id, "BUDGET_APPROVAL"]`.
10. `onCaptured(signature)` → `setOpen(false)` → resolver chama `onResolved()`.
11. `useWizard` marca code no Set → item vira verde otimisticamente.

### 5.2 Pré-existência

1. Resolver monta, `useSignatureExists` faz a query.
2. `hasSignature === true` → `useEffect` chama `onResolved()` automaticamente.
3. UI mostra texto sutil "✓ Assinatura já capturada". Sem botão de refazer.
4. Item do wizard vira verde.

### 5.3 Override do gerente

Não muda nada. O `useWizard` já gerencia override no nível do wizard, independente do resolver.

---

## 6. Edge cases & erros

| Caso | Comportamento |
|---|---|
| Canvas em branco no Confirmar | Botão Confirmar desabilitado até `!isEmpty()`. |
| Nome com menos de 3 chars | Erro inline `aria-live="polite"` + Confirmar desabilitado. |
| CPF inválido digitado (11 dígitos com check) | Aviso inline amarelo; **permite confirmar** (backend não valida). |
| POST falha (5xx, timeout) | `toast.error("Erro ao salvar assinatura. Tente novamente.")`, canvas preservado, botão volta ao normal. Sem leak de `str(e)`. |
| User fecha Sheet com canvas não-vazio | `ConfirmDialog`: "Descartar assinatura?" — Sim fecha sem POST, Não mantém aberto. |
| User fecha Sheet com canvas vazio | Fecha direto, sem prompt. |
| Tela rotaciona (tablet portrait → landscape) | `react-signature-canvas` perde o traço. Toast warn: "Tela girada, refaça a assinatura." Canvas limpa. |
| Pré-existência: `useSignatureExists` em loading | Texto `"Verificando assinaturas…"` em vez do botão. `onResolved` não é chamado prematuramente. |
| Pré-existência: query falha | Trata como `hasSignature === false` (UX permissiva) — usuário vê o botão e tenta. Se POST falhar por duplicidade, mensagem do toast cobre. |
| Override do gerente | Sem mudança. Wizard cuida no nível superior. |
| Múltiplos cliques rápidos em Confirmar | `mutation.isPending` desabilita o botão. |

---

## 7. Testes

### 7.1 Unit (vitest + testing-library)

| Arquivo | Cenários |
|---|---|
| `SignatureCanvas.test.tsx` | Renderiza canvas; `clear()` esvazia; `isEmpty()` true/false após simular trace; `toPng()` retorna base64 sem prefixo `data:`. |
| `SignatureSheet.test.tsx` | Props default preenchem inputs; nome vazio desabilita Confirmar; canvas vazio desabilita Confirmar; sucesso chama `onCaptured` com Signature mockada; erro de rede mostra toast e preserva canvas; fechar com canvas não-vazio dispara ConfirmDialog. |
| `SignatureApprovalResolver.test.tsx` | Loading inicial; pré-existência (count>0) chama `onResolved` no mount sem mostrar botão; sem assinatura (count=0) mostra botão; clicar abre Sheet; `onCaptured` no Sheet chama `onResolved`. |
| `useSignatureCapture.test.ts` | `mutateAsync` faz POST pra `/api/proxy/signatures/capture/` com `method:"CANVAS_TABLET"` injetado. |
| `useSignatureExists.test.ts` | Query URL correta; retorna `true` se `count>0`, `false` caso contrário; desabilitada se `serviceOrderId` falsy. |

**Cobertura alvo:** ≥ 90% nos arquivos novos. Mocks: `apiFetch`, `QueryClientProvider`, `react-signature-canvas` (mock que respeita a interface mínima — `clear`, `isEmpty`, `toDataURL`).

### 7.2 Smoke manual

1. Logar como ADMIN/CONSULTANT.
2. Criar/escolher OS particular (`customer_type="private"`) em status `waiting_auth`.
3. Acionar transição para `authorized` → wizard abre.
4. Verificar item `SIGNATURE_APPROVAL` com botão "Coletar assinatura do cliente".
5. Clicar → Sheet abre fullscreen, nome e CPF pré-preenchidos.
6. Desenhar no canvas, confirmar → toast de sucesso, Sheet fecha, item ✓ no wizard.
7. Clicar Avançar → status muda pra `authorized`.
8. Reabrir wizard (em outro fluxo) — verificar que o item já nasce ✓ (pré-existência detectada).

---

## 8. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| `react-signature-canvas` quebra em React 19 / Next 15 (peer deps) | Validar instalação em DEV antes de mergear; fallback é trocar pela lib `signature_pad` puro com wrapper manual (custo ~1 dia). |
| Backend não aceita PNG > X MB | Canvas exporta ~10-50KB típico (PNG monocromático simples). Sem risco prático. |
| `order.customer.cpf_cnpj` não existe (cliente novo, cadastro incompleto) | Pré-fill cai pra `""`. Usuário digita ou deixa vazio (campo opcional). |
| Múltiplas assinaturas `BUDGET_APPROVAL` duplicadas | Backend hoje permite duplicidade. Pré-existência detecta a primeira e marca ✓ — usuário não vê o canvas e não cria duplicada. Limpeza histórica fora do escopo. |
| Sheet do shadcn não tem modo `size="full"` no projeto | Aplicar classes Tailwind: `className="w-screen h-screen max-w-none"` no `SheetContent`. |

---

## 9. Apêndices

### 9.1 Codes resolvidos antes/depois

- Antes da Sprint B: 18 codes inline (Fase 2 + Fase 4).
- Depois: **19 codes** inline (`+ SIGNATURE_APPROVAL`).

Restantes com FallbackResolver:
`ALL_PARTS_RECEIVED`, `ALL_TIMESHEETS_CLOSED`, `BUDGET_ITEMS_PRIVATE`, `COMPLEMENT_BILLED`, `EXIT_CHECKLIST`, `NFCE_ISSUED`, `PARTS_EXIST`, `PARTS_INCOMPLETE`, `PARTS_OR_LABOR_EXIST`, `PARTS_PENDING`, `PARTS_PURCHASED`, `PARTS_SOURCED`, `RECEIVABLE_CREATED`, `TIMESHEET_CLOSED`, `VERSION_AUTHORIZED`.

### 9.2 Referências

- Spec original do Wizard: `docs/superpowers/specs/2026-06-12-transition-wizard-design.md`
- Plano Fase 4: `docs/superpowers/plans/2026-06-17-transition-wizard-fase-4.md`
- Backend signatures: `backend/core/apps/signatures/{models,views,services}.py`
- Validator: `backend/core/apps/service_orders/transition_validator.py:705-712`
- Mobile canvas (referência de paridade): `apps/mobile/src/components/ui/SignatureCanvas.tsx`
- Mobile hook (paralelo): `apps/mobile/src/hooks/useSignatureCapture.ts`
- Lib externa: `react-signature-canvas` — https://www.npmjs.com/package/react-signature-canvas
