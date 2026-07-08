# Dock Layout — dscar-web

**Data:** 2026-07-08
**Status:** Aprovado (brainstorm com mockups no visual companion)
**Decisões do usuário:** Opção A no desktop (dock inferior flutuante) + bottom tab bar no mobile; submenu por clique; auto-hide; troca direta (sem toggle); base no componente `<Dock />` do React Bits.

## Objetivo

Substituir a sidebar de 260px por um dock inferior flutuante (estilo macOS, com magnification) no desktop e uma bottom tab bar no mobile. Motivação: a sidebar destoa do redesign v2 (tema roxo Paddock) e consome ~260px de largura num ERP denso.

## O que muda / o que não muda

| Muda | Não muda |
|---|---|
| `(app)/layout.tsx` — casca de navegação | Páginas, rotas e slugs |
| `Sidebar` sai do layout (arquivo fica: exporta `NAV_SECTIONS` e helpers) | `NAV_SECTIONS`, role-gating (`minRole`/`requiredPermission`) |
| `MobileSidebar` deletado | `CommandPalette` (⌘K) |
| — | Hooks (`useOverdueOrders` etc.), RBAC, tema |

## Componentes novos

### 1. `components/dock/Dock.tsx` (adaptado do React Bits)

Base: componente `<Dock />` do React Bits (variante JS+CSS) com magnification por proximidade do mouse via `motion` (`useMotionValue`/`useSpring`/`useTransform`).

**Adaptações obrigatórias sobre o código original:**

- **TypeScript strict** — tipar `DockItemData { icon, label, onClick, className? }`, props do painel e remover `cloneElement` sem tipo (usar context ou prop explícita `isHovered`).
- **Tokens no lugar do CSS hardcoded** — o `Dock.css` original usa `#120F17`, `#222`, `#fff`. Converter para Tailwind com tokens (`bg-card`, `border-border`, `text-foreground`, popover shadow) ou CSS vars. Nenhuma cor bruta (regra do projeto).
- **`prefers-reduced-motion`** — `useReducedMotion()`: quando ativo, `magnification = baseItemSize` (sem efeito) e springs viram transições instantâneas.
- **A11y corrigida** — no original, todo item tem `aria-haspopup="true"`; só itens com submenu devem ter (`aria-haspopup="menu"` + `aria-expanded`). Itens já são focáveis com Enter/Espaço (manter). Adicionar `aria-current="page"` no módulo ativo.
- **Badge** — suporte a `badge?: number` no item (contagem de OS atrasadas via `useOverdueOrders`, mesmo comportamento da sidebar: `overdue` + `due_today`).
- **Estado ativo** — item do módulo ativo com `bg-primary/20 border-primary text-primary` (mesma linguagem do mock aprovado).
- Dependência nova: `motion` (importar de `motion/react`).

### 2. `components/dock/DockNav.tsx`

Client component que conecta `NAV_SECTIONS` ao `<Dock />`:

- Achata as seções em ~11 itens de módulo (Dashboard, OS, Agenda, Orçamentos, Cadastros, Financeiro, Fiscal, RH, Estoque, Compras, Configurações), aplicando o mesmo filtro de role/permissão da sidebar (lógica extraída de `Sidebar.tsx` — `visibleSections`).
- Item **com filhos**: clique abre popover pra cima (Radix Popover, `@radix-ui/react-popover` já disponível via shadcn) listando os filhos com ícone + label; item ativo destacado; Escape/clique fora fecha.
- Item **sem filhos**: clique navega (`router.push`).
- **Auto-hide:** esconde ao rolar pra baixo (>64px de delta), reaparece ao rolar pra cima ou com o mouse a ≤24px da borda inferior. Implementar com listener passivo de scroll do `main` + `translateY` via motion value (sem re-render por frame, sem `window.addEventListener('scroll')` cru no React state). Desligado sob `prefers-reduced-motion` (dock fixo).
- Renderiza `hidden md:flex`.

### 3. `components/TopBar.tsx`

Barra fina (~48px, `border-b border-border`): logo DS Car + nome do tenant à esquerda; à direita o trigger de busca (mesmo dispatch de evento ⌘K do Sidebar atual), `NotificationBell` e avatar. Avatar abre dropdown (shadcn DropdownMenu): nome + role, toggle de tema (`ThemeToggle`), "Sair" (`signOut`). Skip-nav link permanece no layout.

### 4. `components/dock/MobileTabBar.tsx`

`fixed bottom-0` visível `< md` (`md:hidden`): os **4 primeiros módulos visíveis pro role** + botão "Mais". "Mais" abre Sheet (shadcn, lado bottom) com grid de ícones dos módulos restantes. Tap navega pro href raiz do módulo (submenus vivem dentro das páginas). Item ativo com acento primary. Badge de atrasadas no ícone de OS.

## Layout final

```tsx
// (app)/layout.tsx
<div className="flex h-screen flex-col overflow-hidden bg-background">
  <a href="#main-content" ...>skip nav</a>
  <TopBar />
  <main id="main-content" className="flex-1 overflow-auto px-6 pt-4 pb-24 max-md:pb-20">
    {children}
  </main>
  <DockNav />        {/* fixed, md+ */}
  <MobileTabBar />   {/* fixed, < md */}
  <CommandPalette />
</div>
```

`pb-24`/`pb-20` garantem que conteúdo/tabelas nunca fiquem sob o dock/tab bar.

## Riscos e mitigação

- **11 ícones ≈ 600px de dock** — ok em ≥1280px; entre `md` e `lg` reduzir `gap` e `baseItemSize` (ex.: 44px) via classe responsiva.
- **Magnification + popover** — o popover ancora no item que muda de tamanho; ancorar no wrapper de tamanho fixo (slot externo) pra não "dançar".
- **Rollback** — troca direta; reverter = revert do commit do layout (páginas intocadas).

## Cleanup

- Deletar `MobileSidebar.tsx`.
- `Sidebar.tsx`: manter temporariamente como fonte de `NAV_SECTIONS`/helpers/`ROLE_LABELS`; mover esses exports para `components/dock/nav-config.ts` e deletar o componente `Sidebar` em si.

## Testes

- Vitest: filtro de role dos itens do dock (OWNER vê 11, STOREKEEPER vê subconjunto; `requiredPermission` respeitado) e mapeamento `NAV_SECTIONS → items`.
- Manual/Playwright: navegação por teclado no dock (Tab, Enter, Escape no popover), auto-hide ao rolar, mobile Sheet "Mais", badge de atrasadas.
