# Design Spec: Tema Claro (Warm Sand) + Correções UX/UI

**Data:** 2026-05-05
**Escopo:** Implementar tema claro alternativo, toggle de tema, e correções de UX/UI identificadas na auditoria.

---

## 1. Tema Claro — "Warm Sand"

### 1.1 Paleta de Cores (CSS Variables no `:root` sem `.dark`)

| Token | Valor HSL | Hex aproximado | Uso |
|-------|-----------|----------------|-----|
| `--background` | `30 100% 99%` | `#fffbf5` | Fundo principal |
| `--foreground` | `25 30% 18%` | `#3d2c1e` | Texto principal |
| `--card` | `0 0% 100%` | `#ffffff` | Cards, tabelas |
| `--card-foreground` | `25 30% 18%` | `#3d2c1e` | Texto em cards |
| `--muted` | `30 30% 94%` | `#f5ede3` | Fundos secundários |
| `--muted-foreground` | `30 20% 40%` | `#8b7355` | Texto secundário |
| `--border` | `30 30% 90%` | `#f3e8d8` | Bordas |
| `--input` | `30 30% 90%` | `#f3e8d8` | Bordas de input |
| `--ring` | `0 82% 42%` | `#c50b02` | Focus ring (mantém primária) |
| `--primary` | `0 90% 38%` | `#b91c1c` | Vermelho vinho |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Texto em botão primário |
| `--secondary` | `30 30% 94%` | `#f5ede3` | Botões secundários |
| `--secondary-foreground` | `25 20% 27%` | `#5c4630` | Texto secundário |
| `--accent` | `30 30% 94%` | `#f5ede3` | Hover states |
| `--accent-foreground` | `25 20% 27%` | `#5c4630` | Texto accent |
| `--destructive` | `0 72% 51%` | `#dc2626` | Ações destrutivas |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | Texto destrutivo |
| `--sidebar-bg` | `30 100% 99%` | `#fffbf5` | Sidebar fundo (igual ao bg) |
| `--sidebar-border` | `30 30% 90%` | `#f3e8d8` | Borda direita sidebar |
| `--sidebar-foreground` | `25 20% 27%` | `#5c4630` | Texto sidebar |
| `--sidebar-active` | `0 90% 38%` | `#b91c1c` | Item ativo sidebar |

### 1.2 Escalas Semânticas (light mode)

| Escala | 100 | 400 | 500 | 600 | 700 | 800 |
|--------|-----|-----|-----|-----|-----|-----|
| success | `#dcfce7` | `#4ade80` | `#22c55e` | `#16a34a` | `#166534` | `#052e16` |
| warning | `#fff7ed` | `#fb923c` | `#f97316` | `#ea580c` | `#9a3412` | `#431407` |
| error | `#fef2f2` | `#f87171` | `#ef4444` | `#dc2626` | `#b91c1c` | `#7f1d1d` |
| info | `#eff6ff` | `#60a5fa` | `#3b82f6` | `#2563eb` | `#1e40af` | `#1e3a5f` |

### 1.3 Sidebar no Modo Claro

- Fundo: `--sidebar-bg` (creme, integrado)
- Separação: borda direita `1px solid var(--sidebar-border)`
- Logo DS Car: vermelha (mesma)
- Seção labels: `--muted-foreground` (tom terroso)
- Item ativo: `--sidebar-active` com `bg-primary/10`
- Item inativo: `--sidebar-foreground`

---

## 2. Toggle de Tema

### 2.1 Posição
- Footer da sidebar, ao lado do avatar do usuário (à direita)
- Botão 28x28px, `border-radius: 6px`
- Ícone: `Sun` (no dark, para ir ao claro) / `Moon` (no claro, para ir ao dark)

### 2.2 Comportamento
1. Clique alterna entre `dark` e `light`
2. Classe no `<html>`: `class="dark"` ou `class="light"` (remove um, aplica outro)
3. Salva em `localStorage` key `"dscar-theme"` valor `"dark"` | `"light"`
4. Na inicialização (antes do React render): script inline no `<head>` lê localStorage e aplica a classe — **evita flash**

### 2.3 Implementação Técnica

```tsx
// src/components/ThemeProvider.tsx
// Context simples com:
// - useState<"dark" | "light"> inicializado de localStorage
// - useEffect para sincronizar classe no documentElement
// - toggleTheme() exposto via context

// src/app/layout.tsx - script inline no <head>:
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    var t = localStorage.getItem('dscar-theme') || 'dark';
    document.documentElement.className = t;
  })()
` }} />
```

### 2.4 Componente Toggle

```tsx
// src/components/ThemeToggle.tsx
// Botão com Sun/Moon icon de lucide-react
// onClick: toggleTheme()
// aria-label="Alternar tema"
```

---

## 3. Correções de Error Handling

### 3.1 Error Boundaries

| Arquivo | Ação |
|---------|------|
| `src/app/error.tsx` | **CRIAR** — error boundary global com botão retry + voltar |
| `src/app/(app)/error.tsx` | **CRIAR** — error boundary do grupo app, mesma estrutura |
| `src/app/(app)/service-orders/[id]/error.tsx` | **ATUALIZAR** — usar design tokens, não expor `error.message` raw |

### 3.2 Página 404

| Arquivo | Ação |
|---------|------|
| `src/app/not-found.tsx` | **CRIAR** — ilustração 404 com "Página não encontrada", botão voltar ao início |

### 3.3 Loading States

| Arquivo | Ação |
|---------|------|
| `src/app/(app)/loading.tsx` | **CRIAR** — skeleton genérico do layout app (sidebar placeholder + content) |
| Páginas pesadas (financeiro, estoque, RH) | Adicionar `loading.tsx` com skeletons específicos |
| `TableSkeleton` | **FIX** — trocar `bg-white` por `bg-card` |

### 3.4 Estados de Auth

| Item | Ação |
|------|------|
| `withRoleGuard` | Retornar skeleton em vez de `null` durante loading |
| `PermissionGate` | Retornar skeleton em vez de `<></>` durante loading |
| Página 403 | Criar componente `AccessDenied` para uso inline |

---

## 4. Correções de Cores e Design Tokens

### 4.1 Prioridade 1 — Pacotes Compartilhados

| Arquivo | Ação |
|---------|------|
| `packages/utils/src/service-order.utils.ts` | Migrar 17 status de `blue-*`/`emerald-*`/`red-*` para `info-*`/`success-*`/`error-*` |
| `packages/types/src/financeiro.types.ts` | Migrar `blue-*` → `info-*`, `red-*` → `error-*` |
| `packages/utils/src/person.utils.ts` | Migrar badges para tokens semânticos |
| `packages/utils/src/form-styles.ts` | `FORM_WARN`: `amber-600` → `warning-600` |

### 4.2 Prioridade 2 — Aplicação

| Arquivo | Ação |
|---------|------|
| `globals.css` | Substituir `#cc4444` por `hsl(var(--primary))` |
| `login/page.tsx` | `text-red-600` → `text-error-600` |
| `ConfirmDialog.tsx` | `text-red-500` → `text-error-500` |
| `ManagerDashboard.tsx` | `text-red-600` → `text-error-600` |
| `HistoryTab.tsx` | Migrar `ACTIVITY_CONFIG` para tokens semânticos |

### 4.3 Prioridade 3 — Sombras e Border-Radius

| Arquivo | Ação |
|---------|------|
| `KanbanCard.tsx` | `shadow-sm/md` → `shadow-kanban/shadow-kanban-drag` |
| `OverdueOSList.tsx` | `shadow-sm` → `shadow-card` |
| `Sidebar.tsx` | `rounded-[10px]` → `rounded-lg`; inline shadow → `shadow-dropdown` |

---

## 5. Correções de Usabilidade

### 5.1 Alta Prioridade

| Item | Ação |
|------|------|
| Breadcrumbs | Montar em todas as páginas de detalhe via `PageHeader` |
| `beforeunload` guard | Adicionar ao `ServiceOrderForm` quando `isDirty` |
| Dialog primitivo | Adicionar Escape handler + focus trap (usar `@radix-ui/react-dialog` ou implementar no custom) |
| `window.confirm` | Substituir por `ConfirmDialog` no `ServicesTab` |
| Sidebar ⌘K | Implementar command palette básico ou remover affordance |
| Sorting em tabelas | Expor `ordering` como controle UI na OS list |

### 5.2 Média Prioridade

| Item | Ação |
|------|------|
| `NewOSDrawer` width | `w-[420px]` → `w-full max-w-[420px]` |
| `RecordPaymentDialog` | Adicionar `toast.success` no `onSuccess` |
| `ServicesTab` loading | Trocar texto por skeleton |
| `DeliveryConfirmationDialog` | Migrar para usar `Dialog` primitivo |
| `UploadDialog` | Migrar para usar `Dialog` primitivo |
| Filter chips | Mostrar filtros ativos como chips removíveis na OS list |

---

## 6. Correções de Acessibilidade

### 6.1 Crítico

| Item | Ação |
|------|------|
| Skip navigation | Adicionar `<a href="#main" class="sr-only focus:not-sr-only">` no layout |
| Dialog ARIA | Adicionar `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |
| Focus trap | Implementar no Dialog via `useFocusTrap` hook ou Radix |
| Form labels | Garantir `htmlFor` + `id` em todos os inputs |
| `aria-invalid` | Adicionar em campos com erro RHF |
| Contraste | Elevar `text-white/30-40` para mínimo `text-white/50` no dark mode |

### 6.2 Importante

| Item | Ação |
|------|------|
| Kanban `KeyboardSensor` | Adicionar ao `useSensors` |
| Kanban card Space key | Tratar `Space` além de `Enter` |
| `scope="col"` | Adicionar ao `TableHead` |
| Icon-only buttons | `title` → `aria-label` |
| Insurer logo alt | `alt=""` → `alt={name}` |
| Tabs arrow nav | Implementar Left/Right/Home/End |
| Breadcrumb `aria-current` | Adicionar `aria-current="page"` no item atual |

---

## 7. Responsividade Mobile

| Item | Ação |
|------|------|
| Sidebar mobile | Hamburger menu com Sheet (overlay) em `< md` |
| OS form header | `flex-wrap` + stacking responsivo |
| Kanban | Adicionar `TouchSensor` + snap horizontal |
| Tabelas financeiras | Card view em mobile com labels inline |

---

## 8. Estrutura de Arquivos Novos

```
src/
├── components/
│   ├── ThemeProvider.tsx          ← Context + hook useTheme
│   ├── ThemeToggle.tsx            ← Botão sol/lua
│   ├── AccessDenied.tsx           ← Componente 403
│   ├── SkipNavigation.tsx         ← Skip to main
│   └── CommandPalette.tsx         ← ⌘K (ou remover affordance)
├── app/
│   ├── error.tsx                  ← Error boundary global
│   ├── not-found.tsx              ← 404 page
│   ├── (app)/
│   │   ├── error.tsx              ← Error boundary grupo app
│   │   └── loading.tsx            ← Skeleton genérico
│   └── globals.css                ← Adicionar variáveis :root (light)
└── hooks/
    └── useFocusTrap.ts            ← Focus trap para dialogs
```

---

## 9. Persistência do Tema

- **Storage:** `localStorage.setItem('dscar-theme', 'dark' | 'light')`
- **Leitura:** Script inline síncrono no `<head>` antes do React hydrate
- **Fallback:** Se localStorage vazio, default = `'dark'` (comportamento atual mantido)
- **SSR:** O script inline garante que a classe é aplicada antes do primeiro paint — sem flash

---

## 10. Critérios de Sucesso

- [ ] Toggle funciona sem flash de tema
- [ ] Preferência persiste entre sessões
- [ ] Todos componentes legíveis nos dois temas
- [ ] Error/404/loading pages existem e são temáticos
- [ ] Contraste WCAG AA (4.5:1) em todo texto
- [ ] Dialog fecha com Escape, trap focus
- [ ] Skip navigation funcional
- [ ] Cores brutas eliminadas dos pacotes compartilhados
