# Wizard de Transição — Fase 4: Resolvers Restantes

**Data:** 2026-06-17
**Autor:** Thiago Campos (brainstorm guiado com Claude Code)
**Status:** Spec aprovado, aguardando plano de implementação
**Predecessor:** `docs/superpowers/specs/2026-06-12-transition-wizard-design.md` (visão geral) + Fase 2 entregue (`docs/superpowers/plans/2026-06-16-transition-wizard-fase-2.md`)

---

## 1. Visão geral

### Contexto

A Fase 2 do Wizard entregou 9 resolvers inline (`CUSTOMER_LINKED`, `CUSTOMER_TYPE_SET`, `VEHICLE_BASIC_DATA`, `FUEL_TYPE`, `MILEAGE_IN`, `MILEAGE_OUT`, `PHOTOS_MIN_12`, `FINAL_PHOTOS_12`, `PROGRESS_PHOTO`) e está em produção via PR #7. O `TransitionRequirementsPanel` continua vivo em paralelo — sua remoção fica para sprint dedicada depois desta.

A Fase 4 cobre **9 resolvers adicionais** que ainda mostram `FallbackResolver` em produção, todos identificados como triviais ou de complexidade média. Após esta sprint, restam apenas os codes Complexos (`PARTS_*`, `TIMESHEET_*`, `NFCE_ISSUED`, `RECEIVABLE_CREATED`, `BUDGET_ITEMS_PRIVATE`, `COMPLEMENT_BILLED`, `VERSION_AUTHORIZED`) que dependem de fluxos do ERP ainda não construídos na UI.

### Objetivo

Eliminar o `FallbackResolver` para 9 codes adicionais, permitindo que o usuário resolva quase qualquer pendência **sem sair do wizard**.

### Fora de escopo

- `SIGNATURE_APPROVAL` — depende de `SignatureCanvas` (Sprint B).
- `EXIT_CHECKLIST` — precisa de design próprio (sprint dedicada).
- Codes Complexos (`PARTS_*`, `TIMESHEET_*`, `NFCE_ISSUED`, `RECEIVABLE_CREATED`, `BUDGET_ITEMS_PRIVATE`, `COMPLEMENT_BILLED`, `VERSION_AUTHORIZED`).
- Remoção do `TransitionRequirementsPanel` (Fase 5, sprint dedicada).
- Cloudflare R2 storage (Sprint A).
- Resolvers de assinatura (Sprint B — depende de canvas web).

### Critérios de sucesso

1. Os 9 codes listados abaixo deixam de mostrar `FallbackResolver` em produção.
2. `CANCEL_JUSTIFICATION` permite ao usuário cancelar OS direto do wizard (caso especial sem PATCH).
3. Sem regressão visual ou de comportamento nos 9 resolvers da Fase 2.
4. Sem migration de backend (zero risco em prod).
5. Cobertura de testes ≥ 90% nos novos resolvers (vitest + testing-library).

---

## 2. Codes cobertos

| # | Code | Campo no backend | Tipo de input | Resolver |
|---|---|---|---|---|
| 1 | `VEHICLE_COLOR` | `color: string` | Input texto | Expande `VehicleDataForm` |
| 2 | `VEHICLE_YEAR` | `year: number \| null` | Input numérico | Expande `VehicleDataForm` |
| 3 | `DEDUCTIBLE_SET` | `deductible_amount: string \| null` | Input decimal | Novo sub-form em `DataResolver` |
| 4 | `CASUALTY_NUMBER` | `casualty_number: string` | Input texto | Novo sub-form em `DataResolver` |
| 5 | `AUTH_DATE_SET` | `authorization_date: string \| null` (datetime) | `datetime-local` | Novo sub-form em `DataResolver` |
| 6 | `ENTRY_DATE_SET` | `entry_date: string \| null` (datetime) | `datetime-local` | Novo sub-form em `DataResolver` |
| 7 | `INSURER_DATA` | `insurer: string \| null` (FK Insurer) | Search + select | Novo `InsurerResolver` |
| 8 | `BUDGET_PDF_INSURER` | upload PDF na pasta `orcamentos` | `<input type="file" accept="application/pdf">` | Novo `FileResolver` (reusa endpoint de fotos) |
| 9 | `CANCEL_JUSTIFICATION` | **N/A — payload da transição** | Textarea | Novo `CancelJustificationResolver` (caso especial) |

---

## 3. Decisões de design

### 3.1 `CANCEL_JUSTIFICATION` — caso especial via Context React

O backend lê `justification` do payload da própria transição (`POST /service-orders/:id/transition/ { new_status: "cancelled", justification: "..." }`), não de um campo no model. Os outros resolvers fazem PATCH → marcam como resolvido → user clica "Avançar" → POST sem justification.

**Abordagem:** Context React isolado para essa "fuga" do padrão.

```tsx
// JustificationContext.tsx (novo)
const JustificationContext = createContext<{
  justification: string
  setJustification: (next: string) => void
}>({ justification: "", setJustification: () => {} })

// TransitionWizard.tsx (modificado)
const [justification, setJustification] = useState("")

function handleClose(): void {
  reset()
  setJustification("")  // limpa estado do contexto também
  onClose()
}

return (
  <JustificationContext.Provider value={{ justification, setJustification }}>
    {/* ... resto do wizard ... */}
  </JustificationContext.Provider>
)

// handleAdvance — injeta justification quando target === 'cancelled'
async function handleAdvance(): Promise<void> {
  const payload: TransitionPayload = { new_status: target }
  if (target === "cancelled") payload.justification = justification
  await transitionMutation.mutateAsync(payload)
  // ...
}

// CancelJustificationResolver.tsx (novo)
export function CancelJustificationResolver({ onResolved }: ResolverProps) {
  const { justification, setJustification } = useContext(JustificationContext)

  // marca resolved quando texto ≥ 10 chars (validação backend mínima)
  useEffect(() => {
    if (justification.trim().length >= 10) onResolved()
  }, [justification])

  return (
    <textarea
      value={justification}
      onChange={(e) => setJustification(e.target.value)}
      rows={3}
      placeholder="Motivo do cancelamento (mínimo 10 caracteres)"
      aria-required="true"
    />
  )
}
```

**Propriedades importantes:**
- Resolver é uma caixa-preta com a mesma fachada (`ResolverProps`) — não polui a interface.
- Marca como `onResolved()` automaticamente quando texto ≥ 10 chars (validação leve client-side; backend revalida).
- O Context só é consumido por este resolver e pelo `TransitionWizard.handleAdvance` — escopo bem definido.
- Se o user fechar o wizard sem avançar, o estado se perde no `reset()` (igual aos outros).

### 3.2 `VEHICLE_COLOR` e `VEHICLE_YEAR` — expandem `VehicleDataForm`

Hoje o `VehicleDataForm` (em `DataResolver.tsx`) edita `plate + make + model`. Vou:

1. **Adicionar campos `color` e `year`** ao formulário (sem alterar lógica de validação dos atuais).
2. **Tornar os 5 campos opcionais** — cada um valida só se o code requer.
3. **Detectar o code via `block.code`** e validar:
   - `VEHICLE_BASIC_DATA` requer `plate + make + model` (comportamento atual)
   - `VEHICLE_COLOR` requer `color`
   - `VEHICLE_YEAR` requer `year`
4. Os 3 novos codes registram para o mesmo `VehicleDataForm`.

**Por que não criar 2 sub-forms separados?** O `VehicleDataForm` já tem layout de campos do veículo. Reaproveitar é DRY e dá ao usuário uma UI consistente. O `block.code` decide o que validar/enviar.

### 3.3 `DEDUCTIBLE_SET`, `CASUALTY_NUMBER` — novos sub-forms em `DataResolver`

Seguem o padrão do `MileageOutForm` — input + Salvar → PATCH → invalidate → `onResolved()`.

```tsx
function DeductibleSetForm({ order, onResolved }: ResolverProps) {
  const qc = useQueryClient()
  const [val, setVal] = useState(order.deductible_amount ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave(): Promise<void> {
    const parsed = parseFloat(val.replace(",", "."))
    if (isNaN(parsed) || parsed < 0) { toast.error("Valor inválido"); return }
    setSaving(true)
    try {
      await patchOrder(order.id, { deductible_amount: parsed.toFixed(2) })
      void qc.invalidateQueries({ queryKey: ["service-orders", order.id] })
      void qc.invalidateQueries({ queryKey: ["service-orders"] })
      onResolved()
    } catch {
      toast.error("Erro ao salvar franquia")
    } finally {
      setSaving(false)
    }
  }

  // ... JSX similar ao MileageOutForm
}
```

### 3.4 `AUTH_DATE_SET`, `ENTRY_DATE_SET` — datetime-local

Reusa o utilitário `toLocalDatetime(iso)` de `apps/dscar-web/src/app/(app)/os/[numero]/_utils/form-defaults.ts` para converter UTC → local. Ao salvar, envia o valor como `YYYY-MM-DDTHH:mm` — o Django interpreta como `America/Manaus` (`TIME_ZONE` no settings).

Padrão do sub-form:

```tsx
function AuthDateForm({ order, onResolved }: ResolverProps) {
  const [val, setVal] = useState(toLocalDatetime(order.authorization_date) ?? "")
  // ... salva em authorization_date
}

function EntryDateForm({ order, onResolved }: ResolverProps) {
  const [val, setVal] = useState(toLocalDatetime(order.entry_date) ?? "")
  // ... salva em entry_date
}
```

Dois sub-forms separados (não compartilham fieldName) — mais claro e evita type assertions.

### 3.5 `INSURER_DATA` — novo `InsurerResolver`

Usa o hook existente `useInsurers(search)` (em `apps/dscar-web/src/hooks/useInsurers.ts`) com debounce. UI parecida com o `CustomerLinkedForm` da Fase 2 (lista clicável de resultados).

Ao selecionar uma seguradora:
```ts
await patchOrder(order.id, { insurer: insurer.id })
```

### 3.6 `BUDGET_PDF_INSURER` — novo `FileResolver`

Reusa o endpoint de upload de fotos (`useUploadPhoto(orderId)`) com `folder='orcamentos'`. Difere do `PhotoResolver`:
- `accept="application/pdf"` em vez de `image/*`
- Single file (não múltiplo) — wizard só precisa de 1 PDF
- Mensagem do backend: parsea contagem com o mesmo regex `(\d+)/(\d+)` se houver, senão assume 0/1

```tsx
export function FileResolver({ block, order, onResolved }: ResolverProps) {
  const uploadMutation = useUploadPhoto(order.id)
  const qc = useQueryClient()
  const counts = parseCount(block.message) ?? { current: 0, required: 1 }
  // ... lógica similar ao PhotoResolver mas single file + PDF accept
}
```

Registrado para `BUDGET_PDF_INSURER`.

### 3.7 Validação leve client-side

Cada resolver valida o input minimamente antes de chamar `onResolved()`:
- `VEHICLE_YEAR`: 1900 ≤ year ≤ 2100
- `DEDUCTIBLE_SET`: > 0
- `AUTH_DATE_SET` / `ENTRY_DATE_SET`: data válida
- `CANCEL_JUSTIFICATION`: ≥ 10 chars
- `INSURER_DATA`: seguradora selecionada
- `BUDGET_PDF_INSURER`: arquivo enviado com sucesso

Backend continua sendo a fonte da verdade — refetch via invalidate confirma.

---

## 4. Arquitetura de componentes

### 4.1 Estrutura de pastas

```
apps/dscar-web/src/components/transition-wizard/
├── JustificationContext.tsx                          # NOVO — caso especial CANCEL_JUSTIFICATION
├── TransitionWizard.tsx                              # MODIFICADO — Provider + handleAdvance
└── resolvers/
    ├── index.ts                                      # MODIFICADO — registra os 9 novos codes
    ├── DataResolver.tsx                              # MODIFICADO — expande VehicleDataForm, adiciona 4 sub-forms
    ├── InsurerResolver.tsx                           # NOVO — INSURER_DATA
    ├── FileResolver.tsx                              # NOVO — BUDGET_PDF_INSURER
    └── CancelJustificationResolver.tsx               # NOVO — CANCEL_JUSTIFICATION
```

### 4.2 Componentes reusados (sem mudanças)

- `useWizard` — set otimista
- `WizardItem` / `WizardChecklist` / `WizardFooter` — UI do wizard
- `OverrideRequestModal` / `ManagerCredentialsModal` — fluxo gerente
- `useUploadPhoto` — endpoint compartilhado para fotos e PDFs (folder controla destino)
- `useInsurers` — hook de seguradoras
- `usePersonSearch` — não usado aqui, mas serve de referência de padrão search

### 4.3 Registro dos resolvers (resolvers/index.ts)

```ts
import { DataResolver } from "./DataResolver"
import { PhotoResolver } from "./PhotoResolver"
import { InsurerResolver } from "./InsurerResolver"
import { FileResolver } from "./FileResolver"
import { CancelJustificationResolver } from "./CancelJustificationResolver"

// Fase 2 + 4
registerResolver(
  [
    // Fase 2
    "VEHICLE_BASIC_DATA", "CUSTOMER_TYPE_SET", "MILEAGE_OUT",
    "FUEL_TYPE", "MILEAGE_IN", "CUSTOMER_LINKED",
    // Fase 4 — triviais no DataResolver
    "VEHICLE_COLOR", "VEHICLE_YEAR",
    "DEDUCTIBLE_SET", "CASUALTY_NUMBER",
    "AUTH_DATE_SET", "ENTRY_DATE_SET",
  ],
  DataResolver,
)

// Fase 2
registerResolver(["PHOTOS_MIN_12", "FINAL_PHOTOS_12", "PROGRESS_PHOTO"], PhotoResolver)

// Fase 4 — novos resolvers
registerResolver(["INSURER_DATA"], InsurerResolver)
registerResolver(["BUDGET_PDF_INSURER"], FileResolver)
registerResolver(["CANCEL_JUSTIFICATION"], CancelJustificationResolver)
```

---

## 5. Data flow

### 5.1 Resolvers padrão (8 dos 9)

Idêntico à Fase 2:

1. User preenche → clica Salvar.
2. Resolver faz `PATCH /service-orders/:id/` (ou `POST /photos/` para `BUDGET_PDF_INSURER`).
3. Invalida `["service-orders", id]` + `["service-orders"]`.
4. Chama `onResolved()` → `useWizard` marca o code no Set.
5. Item fica verde (otimista) + refetch confirma.

### 5.2 `CANCEL_JUSTIFICATION` — fluxo especial

1. User digita motivo no textarea.
2. Texto vai pro `JustificationContext` (state local do TransitionWizard).
3. Quando `text.trim().length >= 10`, `useEffect` chama `onResolved()`.
4. Item fica verde.
5. User clica "Avançar para Cancelado" → `handleAdvance` detecta `target === 'cancelled'` e injeta `justification` no payload.
6. Backend valida + cancela.
7. Sucesso → wizard fecha, OS atualizada.

### 5.3 Edge cases

| Caso | Comportamento |
|---|---|
| User digita menos de 10 chars depois de já ter ≥10 | `useEffect` não desmarca (Set é monotônico). UX: ok porque user pode preencher mais. Backend revalida no advance. |
| User troca o target sem fechar wizard | `JustificationContext` se mantém com o valor. Não há cleanup automático. Aceitável (UX nicho — quase nunca acontece). |
| User abre wizard, digita justificativa, fecha, reabre | `handleClose` no `TransitionWizard` chama `setJustification("")` explicitamente, em adição ao `reset()` do `useWizard`. |
| `BUDGET_PDF_INSURER`: upload de arquivo não-PDF | Browser bloqueia via `accept="application/pdf"`. Backend valida via `FileField` (não checa tipo — futuro). |

---

## 6. Estratégia de testes

### 6.1 Unit (vitest + testing-library)

| Arquivo | Cenários |
|---|---|
| `DataResolver.test.tsx` (existente, ampliado) | Adiciona testes para os 4 novos sub-forms: cada um renderiza, salva, valida input. |
| `InsurerResolver.test.tsx` (novo) | Renderiza input search, busca via `useInsurers` (mock), seleciona, dispara PATCH + onResolved. |
| `FileResolver.test.tsx` (novo) | Renderiza accept=PDF, upload single, contagem 0/1 → 1/1 → `onResolved()`. |
| `CancelJustificationResolver.test.tsx` (novo) | Renderiza textarea, escreve <10 chars → não chama `onResolved`; ≥10 chars → chama; ler/escrever via Context mockado. |
| `JustificationContext.test.tsx` (novo) | Provider expõe value e setter; default é string vazia. |
| `TransitionWizard.test.tsx` (existente, ampliado) | Cenário: target='cancelled' + justificativa preenchida → mutateAsync chamado com `justification` no payload. |

**Meta de cobertura:** 90%+ nos novos arquivos.

### 6.2 Integration / E2E

Não há novos testes E2E. Os testes integration do `TransitionWizard` ficam suficientes (ver Fase 2 — confirmado, smoke manual cobre o resto).

### 6.3 Smoke manual

1. Abrir OS em status que tenha `INSURER_DATA` ou `BUDGET_PDF_INSURER` (orçamento de seguradora).
2. Tentar avançar status → wizard abre.
3. Resolver cada code inline.
4. Confirmar que o footer verde aparece e a transição executa.
5. Bonus: cancelar uma OS via wizard preenchendo `CANCEL_JUSTIFICATION`.

---

## 7. Decisões resolvidas

1. **CANCEL_JUSTIFICATION abordagem** — Context React local ao wizard (Opção B do brainstorm). Sem migration.
2. **Datetime** — `<input type="datetime-local">` usando `toLocalDatetime()` existente. Django interpreta como `America/Manaus`.
3. **BUDGET_PDF_INSURER** — reusa `useUploadPhoto` com `folder='orcamentos'`. PDF passa pelo mesmo `FileField` do backend.
4. **VEHICLE_COLOR / VEHICLE_YEAR** — expandem o `VehicleDataForm` existente. Mesmo `block.code` decide o que validar.
5. **SIGNATURE_APPROVAL fora** — depende de canvas web (Sprint B).
6. **EXIT_CHECKLIST fora** — precisa de design próprio (sprint dedicada).
7. **Fase 5 cleanup fora** — sprint dedicada após validar Wizard Fase 4 em prod por 1-2 semanas.

---

## 8. Apêndices

### 8.1 Códigos do backend cobertos

Antes (Fase 2): 9 codes resolvidos inline. Agora (Fase 4): +9 = **18 codes** resolvidos inline.

Restantes mostrando FallbackResolver após Fase 4 (codes Complexos — cada um requer spec próprio):

`ALL_PARTS_RECEIVED`, `ALL_TIMESHEETS_CLOSED`, `BUDGET_ITEMS_PRIVATE`, `COMPLEMENT_BILLED`, `EXIT_CHECKLIST`, `NFCE_ISSUED`, `PARTS_EXIST`, `PARTS_INCOMPLETE`, `PARTS_OR_LABOR_EXIST`, `PARTS_PENDING`, `PARTS_PURCHASED`, `PARTS_SOURCED`, `RECEIVABLE_CREATED`, `SIGNATURE_APPROVAL`, `TIMESHEET_CLOSED`, `VERSION_AUTHORIZED`.

### 8.2 Referências

- Spec original Wizard: `docs/superpowers/specs/2026-06-12-transition-wizard-design.md`
- Plano Fase 2: `docs/superpowers/plans/2026-06-16-transition-wizard-fase-2.md`
- Backend validators: `backend/core/apps/service_orders/transition_validator.py`
- Hooks reusados: `apps/dscar-web/src/hooks/useInsurers.ts`, `apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useOSItems.ts` (`useUploadPhoto`)
- Util datetime: `apps/dscar-web/src/app/(app)/os/[numero]/_utils/form-defaults.ts` (`toLocalDatetime`)
