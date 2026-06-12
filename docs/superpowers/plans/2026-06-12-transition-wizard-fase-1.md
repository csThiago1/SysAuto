# Wizard de Transição — Fase 1: Extração dos Modais de Override

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair `OverrideRequestModal` e `ManagerCredentialsModal` do `TransitionRequirementsPanel.tsx` pra arquivos próprios sob `components/transition-wizard/`, sem mudança visual nem comportamental, deixando o terreno pronto pras Fases 2-5 que vão construir o wizard ao redor desses dois componentes.

**Architecture:** Refactor cirúrgico. Os 2 modais são componentes React isolados, **controlled** (state continua morando no parent pra preservar comportamento exato), com mesma marcação visual e mesmos handlers do código atual. O `TransitionRequirementsPanel.tsx` deixa de declarar o JSX dos modais e passa a importá-los, passando todas as props necessárias.

**Tech Stack:** React 19, Next.js 16, TypeScript strict, Vitest 2 + @testing-library/react, shadcn/ui Dialog, sonner toast, lucide-react icons.

---

## File Structure

**Created:**
- `apps/dscar-web/src/components/transition-wizard/OverrideRequestModal.tsx` — modal de motivo + 2 caminhos
- `apps/dscar-web/src/components/transition-wizard/ManagerCredentialsModal.tsx` — modal de email+senha do gerente
- `apps/dscar-web/src/components/transition-wizard/index.ts` — barrel exportando ambos
- `apps/dscar-web/src/components/transition-wizard/OverrideRequestModal.test.tsx`
- `apps/dscar-web/src/components/transition-wizard/ManagerCredentialsModal.test.tsx`

**Modified:**
- `apps/dscar-web/package.json` — adiciona `@testing-library/dom` (Task 0)
- `apps/dscar-web/src/app/(app)/os/[numero]/_components/TransitionRequirementsPanel.tsx` — substitui JSX dos modais por chamadas aos componentes novos (Task 4)

**Unchanged (mas tocados via reuso):**
- `apps/dscar-web/src/components/ui/dialog.tsx`
- `apps/dscar-web/src/components/ui/button.tsx`
- `apps/dscar-web/src/hooks/useTransitionValidation.ts`

---

## API dos componentes extraídos

### OverrideRequestModal

```ts
import type { ValidationBlock } from "@paddock/types"

export interface OverrideRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderNumber: string
  currentStatusLabel: string
  targetStatusLabel: string
  softBlocks: ValidationBlock[]
  reason: string                                        // controlled
  onReasonChange: (next: string) => void                // controlled
  isSubmittingRemote: boolean                           // = overrideMutation.isPending
  onManagerPresentClick: () => void                     // valida reason e abre o ManagerCredentialsModal
  onRemoteSubmit: () => void                            // dispara overrideMutation
}
```

### ManagerCredentialsModal

```ts
export interface ManagerCredentialsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string                                         // controlled
  onEmailChange: (next: string) => void                 // controlled
  password: string                                      // controlled
  onPasswordChange: (next: string) => void              // controlled
  isAuthorizing: boolean                                // = transitionMutation.isPending
  onAuthorize: () => void                               // dispara handleForceWithCredentials
}
```

---

## Tasks

---

### Task 0: Fix vitest setup (instalar @testing-library/dom)

**Why:** `@testing-library/react` 16 depende de `@testing-library/dom`, mas a dep não foi declarada — `npm test` falha com `Cannot find module '@testing-library/dom'`. Sem isso, nada do TDD abaixo funciona.

**Files:**
- Modify: `apps/dscar-web/package.json`

- [ ] **Step 1: Instalar a dep**

Run (da raiz do monorepo):
```bash
npm install --workspace=apps/dscar-web --save-dev @testing-library/dom@^10.4.0
```
Expected: `added 1 package` e modificação em `apps/dscar-web/package.json` na seção `devDependencies`.

- [ ] **Step 2: Rodar smoke do vitest**

Run:
```bash
cd apps/dscar-web && npm test -- --reporter=verbose src/hooks/usePermission.test.ts
```
Expected: O arquivo roda até o fim (passe ou falhe nos asserts, mas **não** falha com "Cannot find module"). Se falhar com outro erro, é problema pré-existente — anota mas não bloqueia.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add apps/dscar-web/package.json package-lock.json
git commit -m "chore(web): add @testing-library/dom peer dep for vitest

Resolve 'Cannot find module @testing-library/dom' que bloqueava todos
os testes que usavam @testing-library/react.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1: OverrideRequestModal — teste e componente

**Files:**
- Create: `apps/dscar-web/src/components/transition-wizard/OverrideRequestModal.tsx`
- Create: `apps/dscar-web/src/components/transition-wizard/OverrideRequestModal.test.tsx`

- [ ] **Step 1: Criar o arquivo de teste com casos falhando**

Path: `apps/dscar-web/src/components/transition-wizard/OverrideRequestModal.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { OverrideRequestModal } from "./OverrideRequestModal"
import type { ValidationBlock } from "@paddock/types"

const SOFT_BLOCKS: ValidationBlock[] = [
  { code: "PHOTOS_MIN_12", message: "Faltam fotos da vistoria" },
  { code: "CLIENT_SIGNATURE", message: "Cliente ainda não assinou" },
]

function baseProps(overrides: Partial<React.ComponentProps<typeof OverrideRequestModal>> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    orderNumber: "1234",
    currentStatusLabel: "Recepção",
    targetStatusLabel: "Orçamento",
    softBlocks: SOFT_BLOCKS,
    reason: "",
    onReasonChange: vi.fn(),
    isSubmittingRemote: false,
    onManagerPresentClick: vi.fn(),
    onRemoteSubmit: vi.fn(),
    ...overrides,
  }
}

describe("OverrideRequestModal", () => {
  it("não renderiza nada quando open=false", () => {
    render(<OverrideRequestModal {...baseProps({ open: false })} />)
    expect(screen.queryByText(/Solicitar Liberação/i)).not.toBeInTheDocument()
  })

  it("mostra título com número da OS e os labels de transição", () => {
    render(<OverrideRequestModal {...baseProps()} />)
    expect(screen.getByText(/Solicitar Liberação — OS #1234/i)).toBeInTheDocument()
    expect(screen.getByText(/Recepção/)).toBeInTheDocument()
    expect(screen.getByText(/Orçamento/)).toBeInTheDocument()
  })

  it("lista todos os soft blocks com a mensagem do backend", () => {
    render(<OverrideRequestModal {...baseProps()} />)
    expect(screen.getByText("Faltam fotos da vistoria")).toBeInTheDocument()
    expect(screen.getByText("Cliente ainda não assinou")).toBeInTheDocument()
  })

  it("chama onReasonChange ao digitar no textarea", async () => {
    const user = userEvent.setup()
    const onReasonChange = vi.fn()
    render(<OverrideRequestModal {...baseProps({ onReasonChange })} />)
    await user.type(screen.getByRole("textbox", { name: /motivo/i }), "abc")
    expect(onReasonChange).toHaveBeenCalled()
  })

  it("desabilita 'Aprovação remota' enquanto reason está vazia", () => {
    render(<OverrideRequestModal {...baseProps({ reason: "   " })} />)
    expect(screen.getByRole("button", { name: /aprovação remota/i })).toBeDisabled()
  })

  it("habilita 'Aprovação remota' quando há reason preenchida", () => {
    render(<OverrideRequestModal {...baseProps({ reason: "cliente fora do estado" })} />)
    expect(screen.getByRole("button", { name: /aprovação remota/i })).not.toBeDisabled()
  })

  it("chama onRemoteSubmit ao clicar em 'Aprovação remota'", async () => {
    const user = userEvent.setup()
    const onRemoteSubmit = vi.fn()
    render(<OverrideRequestModal {...baseProps({ reason: "cliente fora", onRemoteSubmit })} />)
    await user.click(screen.getByRole("button", { name: /aprovação remota/i }))
    expect(onRemoteSubmit).toHaveBeenCalledTimes(1)
  })

  it("chama onManagerPresentClick ao clicar em 'Gerente presente'", async () => {
    const user = userEvent.setup()
    const onManagerPresentClick = vi.fn()
    render(<OverrideRequestModal {...baseProps({ reason: "ok", onManagerPresentClick })} />)
    await user.click(screen.getByRole("button", { name: /gerente presente/i }))
    expect(onManagerPresentClick).toHaveBeenCalledTimes(1)
  })

  it("mostra spinner em 'Aprovação remota' quando isSubmittingRemote=true", () => {
    render(<OverrideRequestModal {...baseProps({ reason: "ok", isSubmittingRemote: true })} />)
    const button = screen.getByRole("button", { name: /aprovação remota/i })
    expect(button).toBeDisabled()
    expect(button.querySelector(".animate-spin")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar com "module not found"**

Run:
```bash
cd apps/dscar-web && npm test -- src/components/transition-wizard/OverrideRequestModal.test.tsx
```
Expected: erro `Failed to resolve import "./OverrideRequestModal"` ou equivalente.

- [ ] **Step 3: Criar o componente**

Path: `apps/dscar-web/src/components/transition-wizard/OverrideRequestModal.tsx`

```tsx
"use client"

import { Loader2, Lock } from "lucide-react"
import type { ValidationBlock } from "@paddock/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface OverrideRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderNumber: string
  currentStatusLabel: string
  targetStatusLabel: string
  softBlocks: ValidationBlock[]
  reason: string
  onReasonChange: (next: string) => void
  isSubmittingRemote: boolean
  onManagerPresentClick: () => void
  onRemoteSubmit: () => void
}

/**
 * Modal de solicitação de override do gerente.
 *
 * Mostra a lista de soft blocks pendentes, um textarea pro motivo e dois
 * caminhos: "Gerente presente" (abre o ManagerCredentialsModal) ou
 * "Aprovação remota" (dispara POST /override-request/).
 *
 * Componente controlled — o reason e o estado de submissão remota moram no
 * parent pra continuar refletindo o ciclo de vida da OS.
 */
export function OverrideRequestModal({
  open,
  onOpenChange,
  orderNumber,
  currentStatusLabel,
  targetStatusLabel,
  softBlocks,
  reason,
  onReasonChange,
  isSubmittingRemote,
  onManagerPresentClick,
  onRemoteSubmit,
}: OverrideRequestModalProps) {
  const reasonFilled = reason.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Liberação — OS #{orderNumber}</DialogTitle>
          <DialogDescription>
            Transição: {currentStatusLabel} → {targetStatusLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-2">Bloqueios pendentes:</p>
            <ul className="space-y-1">
              {softBlocks.map((b) => (
                <li
                  key={b.code}
                  className="flex items-start gap-2 text-sm text-warning-500"
                >
                  <Lock className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                  {b.message}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="override-reason" className="text-sm font-medium">
              Motivo da solicitação{" "}
              <span className="text-error-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id="override-reason"
              aria-required="true"
              aria-label="Motivo da solicitação"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
              placeholder="Explique por que a transição deve ser liberada..."
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Como liberar:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={onManagerPresentClick}>
                Gerente presente
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!reasonFilled || isSubmittingRemote}
                onClick={onRemoteSubmit}
              >
                {isSubmittingRemote ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
                ) : null}
                Aprovação remota
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run:
```bash
npm test -- src/components/transition-wizard/OverrideRequestModal.test.tsx
```
Expected: `8 tests passed`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/OverrideRequestModal.tsx apps/dscar-web/src/components/transition-wizard/OverrideRequestModal.test.tsx
git commit -m "feat(wizard): extract OverrideRequestModal component

Componente isolado, controlled, com cobertura de teste (8 casos: render
condicional, lista de blocks, textarea, disable/enable, callbacks,
spinner). Sem mudança de comportamento — TransitionRequirementsPanel
passa a importar e usar este componente na Task 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: ManagerCredentialsModal — teste e componente

**Files:**
- Create: `apps/dscar-web/src/components/transition-wizard/ManagerCredentialsModal.tsx`
- Create: `apps/dscar-web/src/components/transition-wizard/ManagerCredentialsModal.test.tsx`

- [ ] **Step 1: Criar o arquivo de teste**

Path: `apps/dscar-web/src/components/transition-wizard/ManagerCredentialsModal.test.tsx`

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { ManagerCredentialsModal } from "./ManagerCredentialsModal"

function baseProps(overrides: Partial<React.ComponentProps<typeof ManagerCredentialsModal>> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    email: "",
    onEmailChange: vi.fn(),
    password: "",
    onPasswordChange: vi.fn(),
    isAuthorizing: false,
    onAuthorize: vi.fn(),
    ...overrides,
  }
}

describe("ManagerCredentialsModal", () => {
  it("não renderiza nada quando open=false", () => {
    render(<ManagerCredentialsModal {...baseProps({ open: false })} />)
    expect(screen.queryByText(/Credenciais do Gerente/i)).not.toBeInTheDocument()
  })

  it("mostra título e descrição", () => {
    render(<ManagerCredentialsModal {...baseProps()} />)
    expect(screen.getByText(/Credenciais do Gerente/i)).toBeInTheDocument()
    expect(screen.getByText(/gerente deve digitar/i)).toBeInTheDocument()
  })

  it("chama onEmailChange ao digitar no input de email", async () => {
    const user = userEvent.setup()
    const onEmailChange = vi.fn()
    render(<ManagerCredentialsModal {...baseProps({ onEmailChange })} />)
    await user.type(screen.getByLabelText(/email/i), "g@dscar.com")
    expect(onEmailChange).toHaveBeenCalled()
  })

  it("chama onPasswordChange ao digitar no input de senha", async () => {
    const user = userEvent.setup()
    const onPasswordChange = vi.fn()
    render(<ManagerCredentialsModal {...baseProps({ onPasswordChange })} />)
    await user.type(screen.getByLabelText(/senha/i), "x")
    expect(onPasswordChange).toHaveBeenCalled()
  })

  it("desabilita 'Autorizar' quando email vazio", () => {
    render(<ManagerCredentialsModal {...baseProps({ email: "", password: "x" })} />)
    expect(screen.getByRole("button", { name: /autorizar/i })).toBeDisabled()
  })

  it("desabilita 'Autorizar' quando senha vazia", () => {
    render(<ManagerCredentialsModal {...baseProps({ email: "g@d.com", password: "" })} />)
    expect(screen.getByRole("button", { name: /autorizar/i })).toBeDisabled()
  })

  it("habilita 'Autorizar' quando email e senha preenchidos", () => {
    render(<ManagerCredentialsModal {...baseProps({ email: "g@d.com", password: "x" })} />)
    expect(screen.getByRole("button", { name: /autorizar/i })).not.toBeDisabled()
  })

  it("chama onAuthorize ao clicar em 'Autorizar'", async () => {
    const user = userEvent.setup()
    const onAuthorize = vi.fn()
    render(<ManagerCredentialsModal {...baseProps({ email: "g@d.com", password: "x", onAuthorize })} />)
    await user.click(screen.getByRole("button", { name: /autorizar/i }))
    expect(onAuthorize).toHaveBeenCalledTimes(1)
  })

  it("chama onOpenChange(false) ao clicar em 'Cancelar'", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<ManagerCredentialsModal {...baseProps({ onOpenChange })} />)
    await user.click(screen.getByRole("button", { name: /cancelar/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("mostra spinner em 'Autorizar' quando isAuthorizing=true", () => {
    render(<ManagerCredentialsModal {...baseProps({ email: "g@d.com", password: "x", isAuthorizing: true })} />)
    const button = screen.getByRole("button", { name: /autorizar/i })
    expect(button).toBeDisabled()
    expect(button.querySelector(".animate-spin")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run:
```bash
npm test -- src/components/transition-wizard/ManagerCredentialsModal.test.tsx
```
Expected: erro de import não encontrado.

- [ ] **Step 3: Criar o componente**

Path: `apps/dscar-web/src/components/transition-wizard/ManagerCredentialsModal.tsx`

```tsx
"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface ManagerCredentialsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  onEmailChange: (next: string) => void
  password: string
  onPasswordChange: (next: string) => void
  isAuthorizing: boolean
  onAuthorize: () => void
}

/**
 * Modal de credenciais do gerente. Recebe email/senha como controlled props
 * e dispara onAuthorize quando o gerente confirma. Botão "Cancelar" fecha
 * via onOpenChange(false).
 */
export function ManagerCredentialsModal({
  open,
  onOpenChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  isAuthorizing,
  onAuthorize,
}: ManagerCredentialsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Credenciais do Gerente</DialogTitle>
          <DialogDescription>
            O gerente deve digitar suas credenciais para autorizar a transição.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label htmlFor="manager-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="manager-email"
              type="email"
              autoComplete="username"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="gerente@dscar.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="manager-password" className="text-sm font-medium">
              Senha
            </label>
            <input
              id="manager-password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!email || !password || isAuthorizing}
            onClick={onAuthorize}
          >
            {isAuthorizing && (
              <Loader2 className="h-4 w-4 animate-spin mr-1" aria-hidden="true" />
            )}
            Autorizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run:
```bash
npm test -- src/components/transition-wizard/ManagerCredentialsModal.test.tsx
```
Expected: `10 tests passed`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/ManagerCredentialsModal.tsx apps/dscar-web/src/components/transition-wizard/ManagerCredentialsModal.test.tsx
git commit -m "feat(wizard): extract ManagerCredentialsModal component

Componente isolado, controlled, com cobertura de teste (10 casos:
render condicional, inputs, validação dos botões, cancelar, spinner).
Sem mudança de comportamento.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Barrel de export

**Files:**
- Create: `apps/dscar-web/src/components/transition-wizard/index.ts`

- [ ] **Step 1: Criar o barrel**

Path: `apps/dscar-web/src/components/transition-wizard/index.ts`

```ts
export {
  OverrideRequestModal,
  type OverrideRequestModalProps,
} from "./OverrideRequestModal"

export {
  ManagerCredentialsModal,
  type ManagerCredentialsModalProps,
} from "./ManagerCredentialsModal"
```

- [ ] **Step 2: Verificar que typecheck passa**

Run:
```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add apps/dscar-web/src/components/transition-wizard/index.ts
git commit -m "feat(wizard): add barrel exporting both modal components

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Refactor — TransitionRequirementsPanel usa os componentes extraídos

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/TransitionRequirementsPanel.tsx`

- [ ] **Step 1: Adicionar import dos novos componentes**

No arquivo `TransitionRequirementsPanel.tsx`, próximo aos outros imports (logo após a linha `import { ... } from "@/hooks/useTransitionValidation"`), adicione:

```ts
import { OverrideRequestModal, ManagerCredentialsModal } from "@/components/transition-wizard"
```

- [ ] **Step 2: Remover os ícones e o `Dialog*` que não serão mais usados aqui**

Os componentes extraídos passam a importar `Loader2`, `Lock`, `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle` por conta própria. No `TransitionRequirementsPanel.tsx`, verifique se ainda há outros usos dessas importações na seção que **fica** no arquivo (lista de requisitos, botões de ação). Mantenha apenas o que continua sendo usado.

Estado esperado depois da limpeza:
- `Lock` ainda é usado na seção de "lista de requisitos" (linha ~159). **Mantém.**
- `Loader2` ainda é usado no botão "Avançar Status" e indicador de override pendente. **Mantém.**
- `Dialog`, `DialogContent`, etc. **não** são mais usados diretamente. **Remove do import.**

Substitua o bloco de imports do shadcn dialog:

```ts
// REMOVE estas linhas:
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
```

- [ ] **Step 3: Substituir o JSX dos dois modais por chamadas aos componentes**

No arquivo `TransitionRequirementsPanel.tsx`, encontre o bloco que começa em `{/* Modal de solicitacao de override */}` (linha ~227 hoje). Substitua **toda** a marcação dos dois `<Dialog>` (linhas 227 a 365 hoje) por:

```tsx
      {/* Modal de solicitação de override */}
      <OverrideRequestModal
        open={overrideModalOpen}
        onOpenChange={setOverrideModalOpen}
        orderNumber={String(order.number)}
        currentStatusLabel={
          SERVICE_ORDER_STATUS_CONFIG[order.status as ServiceOrderStatus]?.label ??
          order.status
        }
        targetStatusLabel={primaryTargetLabel}
        softBlocks={validation?.soft_blocks ?? []}
        reason={overrideReason}
        onReasonChange={setOverrideReason}
        isSubmittingRemote={overrideMutation.isPending}
        onManagerPresentClick={() => {
          if (!overrideReason.trim()) {
            toast.error("Preencha o motivo da solicitação")
            return
          }
          setManagerModalOpen(true)
        }}
        onRemoteSubmit={() => void handleRequestRemoteOverride()}
      />

      {/* Modal de credenciais do gerente */}
      <ManagerCredentialsModal
        open={managerModalOpen}
        onOpenChange={setManagerModalOpen}
        email={managerEmail}
        onEmailChange={setManagerEmail}
        password={managerPassword}
        onPasswordChange={setManagerPassword}
        isAuthorizing={transitionMutation.isPending}
        onAuthorize={() => void handleForceWithCredentials()}
      />
```

- [ ] **Step 4: Rodar typecheck**

Run:
```bash
cd apps/dscar-web && npm run typecheck
```
Expected: zero erros. Se acusar erro de tipo em `String(order.number)` ou em `validation?.soft_blocks ?? []`, **pare e revise** — o tipo de `validation` vem de `order.transition_requirements[primaryTarget]` e deve ter `soft_blocks?: ValidationBlock[]`. Ajuste a passagem de prop preservando a semântica original.

- [ ] **Step 5: Rodar os testes existentes do projeto**

Run:
```bash
npm test
```
Expected: os 2 arquivos novos (Task 1 e 2) passam (18 testes). Outros arquivos podem falhar por motivos pré-existentes — anota mas não bloqueia.

- [ ] **Step 6: Commit**

```bash
cd ../..
git add apps/dscar-web/src/app/\(app\)/os/\[numero\]/_components/TransitionRequirementsPanel.tsx
git commit -m "refactor(os): TransitionRequirementsPanel usa modais extraídos

Substitui o JSX inline dos dois modais por OverrideRequestModal e
ManagerCredentialsModal de components/transition-wizard/. Zero
mudança visual ou comportamental — props controlled mantêm o state
no parent (overrideReason, managerEmail, managerPassword).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Smoke test manual + sync com main

**Files:** nenhum.

- [ ] **Step 1: Subir dev server**

Run (em terminal separado):
```bash
cd apps/dscar-web && npm run dev
```
Aguarda a mensagem `Ready in ...`. Não fecha esse terminal.

- [ ] **Step 2: Abrir uma OS no browser**

1. Abre `http://localhost:3001` no Chrome (modo claro pra ver mais bugs).
2. Loga (`admin@paddock.solutions` / `paddock123`).
3. Navega pra `/os`, abre qualquer OS que esteja em status com soft block na próxima transição. Se não souber qual, abre o painel admin do Django (`http://localhost:8000/admin`) e ajusta uma OS pra um status que tenha requisitos não atendidos.

- [ ] **Step 3: Disparar o fluxo de override**

1. Na tela de detalhe da OS, localiza o `<TransitionRequirementsPanel>` (geralmente dentro da aba Fechamento ou na seção de ações).
2. Confirma que o título mostra "Para avançar para X" e a lista de requisitos aparece igual a antes.
3. Clica "Solicitar Liberação".
4. Confirma que o `OverrideRequestModal` abre:
   - Título `Solicitar Liberação — OS #{número}`.
   - Lista de soft blocks com cadeado.
   - Textarea funcional (digita "teste").
   - "Aprovação remota" habilita.
5. Clica "Gerente presente" sem motivo → confirma toast "Preencha o motivo da solicitação".
6. Preenche motivo, clica "Gerente presente" → confirma que `ManagerCredentialsModal` abre.
7. Confirma que ambos os inputs funcionam, que "Autorizar" desabilita sem dados.
8. Fecha sem submeter (clica "Cancelar" — confirma que volta pro state anterior).

- [ ] **Step 4: Sanity check visual com a versão anterior**

Side-by-side mental: nenhuma cor, espaçamento, texto ou animação deve ter mudado. Se ver qualquer diferença, **pare** e diagnostica antes de seguir — Fase 1 é refactor de zero mudança visual.

- [ ] **Step 5: Push e abrir PR**

```bash
git log --oneline main..HEAD
```
Expected: 5 commits (Task 0 + 4).

```bash
git push origin main
```
Vercel vai detectar e fazer build. Aguarda `● Ready` antes de avisar o produto.

---

## Plano completo finalizado

Após Task 5, a Fase 1 está entregue. O código está pronto pra Fase 2 começar (criação do `TransitionWizard` que vai usar esses 2 modais como sub-componentes). O `TransitionRequirementsPanel.tsx` continua existindo e funcionando — vai morrer só na Fase 5.

**Cobertura final:**
- 18 testes unit novos (`OverrideRequestModal`: 8, `ManagerCredentialsModal`: 10).
- Zero regressão visual (smoke manual + props controlled).
- Setup vitest desbloqueado pra próximas fases.
