# Nova UI — Sidebar DS Car
**Data:** 2026-04-11
**App:** `apps/dscar-web`
**Escopo:** Substituição completa do Sidebar + remoção do AppHeader

---

## Objetivo

Substituir a sidebar e o layout atual do ERP DS Car pela nova UI do arquivo `docs/nova ui/`, integrando todas as funcionalidades do `AppHeader` diretamente na sidebar. O resultado é um layout sem barra de topo — toda navegação, notificações e controle de sessão ficam na coluna lateral.

---

## Layout

**Antes:**
```
grid-cols-[240px_1fr]
├── Sidebar (esquerda)
└── div
    ├── AppHeader (topo — h-16, borda inferior, fundo branco)
    └── main (conteúdo)
```

**Depois:**
```
flex h-screen overflow-hidden bg-[#0a0a0a]
├── Sidebar (esquerda — fixo, h-screen, scroll próprio na nav)
└── main (flex-1 overflow-auto — scroll independente)
```

O sidebar nunca acompanha o scroll do conteúdo. A propriedade `overflow-hidden` no wrapper raiz garante isso.

---

## Sidebar — Estrutura

### Header (topo)
- Logo DS Car inline (quadrado vermelho `#ea0e03` + texto "DS CAR / ERP SYSTEM")
- Quando **expandido**: logo à esquerda + `NotificationBell` + botão `ChevronLeft` para colapsar
- Quando **colapsado**: só o logo (quadrado) + botão circular `ChevronRight` flutuante na borda direita

### Search bar
- Campo visual "Buscar... ⌘K" abaixo do header
- Quando colapsado: só o ícone `Search`
- Funcional futuramente — por agora apenas visual

### Navigation (nav)
Seções com label em caps:

```
GERAL
  Dashboard              /dashboard
  Ordens de Serviço ▼    grupo expansível
    └ Lista de OS        /service-orders
    └ Kanban             /service-orders/kanban
  Cadastros              /cadastros

FINANCEIRO
  Financeiro ▼           grupo expansível
    └ Visão Geral        /financeiro
    └ Lançamentos        /financeiro/lancamentos
    └ Plano de Contas    /financeiro/plano-contas
    └ Contas a Pagar     /financeiro/contas-pagar
    └ Contas a Receber   /financeiro/contas-receber

RH
  Recursos Humanos ▼     grupo expansível
    └ Dashboard RH       /rh
    └ Colaboradores      /rh/colaboradores
    └ Ponto              /rh/ponto
    └ Espelho de Ponto   /rh/ponto/espelho
    └ Metas              /rh/metas
    └ Vales              /rh/vales
    └ Folha              /rh/folha
    └ Contracheques      /rh/folha/contracheque

SISTEMA
  Configurações          /configuracoes  (página não existe ainda — item navegável)
```

**Comportamento de grupos:**
- Auto-expande o grupo que contém a rota ativa ao montar
- Colapsar a sidebar expande automaticamente ao clicar num grupo colapsado
- Ícone `ChevronDown` rotaciona 180° quando expandido

**Estado ativo:**
- Barra vertical `#ea0e03` (3px) à esquerda do item pai ativo
- Fundo `#ea0e03/12` + texto `#ea0e03` no item ativo
- Dot `#ea0e03` no filho ativo

**Modo colapsado:**
- Labels e filhos ocultados
- Tooltip aparece à direita ao hover (posicionado com `getBoundingClientRect`)
- Badge de OS vencidas vira ponto vermelho no ícone

### Footer (base)
- Avatar com iniciais do usuário (gradiente `#ea0e03 → #ffe000`)
- Nome completo + role (de `useSession`)
- Badge "DS Car" com ícone `Building2`
- Botão `LogOut` chama `signOut({ callbackUrl: "/login" })`
- Quando colapsado: só avatar centralizado

---

## Migração do AppHeader

| Funcionalidade | Destino |
|---|---|
| Título da página | **Removido** — item ativo na nav provê contexto |
| `NotificationBell` | Header da sidebar (ao lado do logo) |
| Badge empresa "DS Car" | Footer da sidebar |
| Avatar + nome do usuário | Footer da sidebar (via `useSession`) |
| Botão Logout | Footer da sidebar (via `signOut`) |

---

## Estado de Colapso

O estado `collapsed` passa a ser `useState` local no componente `Sidebar`. O `useUIStore.sidebarCollapsed` e `toggleSidebar` são removidos do store — o layout não precisa mais reagir à largura da sidebar (usa `flex` com `w-[260px]`/`w-[72px]` direto no `<aside>`).

---

## Tipografia

- `Montserrat` adicionada como `font-sans` no root layout (via `next/font/google`)
- `Rajdhani` mantida como `font-plate` (placas veiculares, badges de OS)
- `Inter` removida do root layout

---

## Arquivos a modificar

| Arquivo | Operação |
|---|---|
| `src/app/(app)/layout.tsx` | Reescrever — remove `AppHeader`, flex layout, overflow-hidden |
| `src/components/Sidebar.tsx` | Substituição completa pelo novo design |
| `src/app/layout.tsx` | Trocar `Inter` por `Montserrat` como `font-sans` |
| `tailwind.config.ts` | Atualizar `fade-in` keyframe (adicionar translateX) |
| `src/app/globals.css` | Adicionar CSS de scrollbar para `.scrollbar-thin` |
| `src/store/ui.store.ts` | Remover `sidebarCollapsed` e `toggleSidebar` |

---

## Arquivos a verificar (possíveis dependências do `useUIStore.sidebarCollapsed`)

- Qualquer componente que importe `useUIStore` e leia `sidebarCollapsed` precisa ser atualizado

---

## O que não muda

- Rotas existentes — nenhuma rota é alterada
- `NotificationBell` — lógica e componente intactos, só muda onde é renderizado
- shadcn/ui components — `Popover`, `Badge`, `Button` continuam sendo usados
- `DsCarLogo` component — substituído pelo logo inline do novo design (mais simples, sem dependência externa)

---

## Critério de conclusão

- Sidebar renderiza com seções, grupos expansíveis, item ativo destacado, tooltips no modo colapsado
- Scroll do `<main>` não move o sidebar
- NotificationBell funcional no header da sidebar
- Footer exibe dados reais do usuário logado
- `AppHeader` e `DsCarLogo` não são mais importados em nenhum arquivo
- `make typecheck` passa sem erros
