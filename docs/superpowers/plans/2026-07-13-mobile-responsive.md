# Mutirão Mobile — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os 29 problemas da auditoria mobile (390px) e instituir o padrão responsivo compartilhado do app.

**Architecture:** Regras documentadas no CLAUDE.md + componente `ScrollFade` compartilhado + conversão das tabelas operacionais para cards no mobile (padrão-ouro: `/financeiro/contas-pagar/page.tsx` — tabela `hidden md:grid` + cards `md:hidden`). Correções pontuais de classe (grids KPI, headers, overflow do layout) tela a tela, guiadas pelos relatórios `.superpowers/sdd/mobile-audit-part{1,2}.md`.

**Tech Stack:** Next.js 15 + Tailwind (tema escuro, design tokens), Vitest, Playwright (verificação).

**Spec:** `docs/superpowers/specs/2026-07-13-mobile-responsive-design.md` (LER antes de cada task)

## Global Constraints

- Viewport de referência: **390×844**. Toda task de tela termina com verificação Playwright nesse viewport (dev server em `http://localhost:3001`, login `admin@paddock.solutions`/`admin123`).
- PROIBIDO `overflow-hidden` em wrapper de tabela — piso é `overflow-x-auto` (via `ScrollFade`).
- KPI grids: `grid-cols-2` no mobile (`grid grid-cols-2 gap-3 lg:grid-cols-4` ou `lg:grid-cols-3`).
- Cards mobile seguem o esqueleto de `/financeiro/contas-pagar/page.tsx:236-320` (tabela `hidden md:grid` + lista `md:hidden space-y-3`) — copiar a estrutura, adaptar os campos.
- Design tokens SEMPRE (success-*/error-*/warning-*/info-*, bg-muted, border-border) — nunca cores brutas.
- TypeScript strict; sem `any`.
- Nenhuma dependência nova.
- Não alterar lógica de dados/hooks — só apresentação (JSX/classes). Exceção: extrair sub-componente de card no mesmo arquivo ou arquivo irmão `_components/` é permitido.
- Conventional commits pt-BR: `fix(dscar): ...` ou `feat(dscar): ...`.
- Gate por task: `cd apps/dscar-web && npx tsc --noEmit` limpo + verificação visual Playwright da(s) tela(s) da task + screenshot no report.
- eslint do monorepo está quebrado (node_modules raiz, pré-existente) — não é gate.
- Os relatórios de auditoria têm file:line exatos de cada problema — o brief de cada task cita os itens; o implementador DEVE ler o trecho correspondente do relatório de auditoria antes de editar.

---

### Task 1: Fundação — regra global de overflow, `ScrollFade`, `PageHeader` e CLAUDE.md

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/layout.tsx:21-24` (main `overflow-auto` → conter scroll-x)
- Create: `apps/dscar-web/src/components/ui/scroll-fade.tsx`
- Modify: `apps/dscar-web/src/components/ui/page-header.tsx:19-42`
- Modify: `CLAUDE.md` (raiz do monorepo — seção nova)

**Interfaces:**
- Produces: `<ScrollFade className?>{children}</ScrollFade>` — wrapper com `overflow-x-auto` + fade de borda direita; usado pelas Tasks 2-8. `PageHeader` passa a quebrar linha sem espremer título.

- [ ] **Step 1: `ScrollFade`**

Criar `apps/dscar-web/src/components/ui/scroll-fade.tsx`:

```tsx
"use client"

import { cn } from "@/lib/utils"

/**
 * Wrapper de rolagem horizontal com fade indicando conteúdo além da borda.
 * Piso responsivo de tabelas/tab bars — NUNCA usar overflow-hidden nelas.
 */
export function ScrollFade({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="overflow-x-auto">{children}</div>
      {/* fade só decorativo; some em md+ onde raramente há corte */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background/90 to-transparent md:hidden"
      />
    </div>
  )
}
```

- [ ] **Step 2: main do layout sem scroll-x de página**

Em `apps/dscar-web/src/app/(app)/layout.tsx`, no `<main>` (linha ~21): trocar `overflow-auto` por `overflow-y-auto overflow-x-hidden` (manter as demais classes).

- [ ] **Step 3: PageHeader com wrap decente**

Em `apps/dscar-web/src/components/ui/page-header.tsx`: no container raiz do header, garantir `flex flex-wrap items-start justify-between gap-x-4 gap-y-2`; no bloco do título, `min-w-0` (título pode usar `break-words`); no bloco de ações, `flex flex-wrap items-center gap-2 shrink-0`. Ler o arquivo antes — preservar props/API; só classes mudam.

- [ ] **Step 4: Documentar o padrão no CLAUDE.md**

Adicionar ao `CLAUDE.md` da raiz, dentro de "Padrões de Código", a seção:

```markdown
### Responsividade Mobile (viewport de referência: 390px)

- Tabelas operacionais: tabela `hidden md:grid`/`hidden md:table` + cards `md:hidden space-y-3`
  (padrão-ouro: financeiro/contas-pagar). Tabela que ainda não virou cards: wrapper `ScrollFade`
  (`@/components/ui/scroll-fade`) — PROIBIDO `overflow-hidden` em wrapper de tabela.
- KPI cards: `grid grid-cols-2 gap-3 lg:grid-cols-4` — nunca `grid-cols-3/4` fixo.
- Header de página: `flex flex-wrap gap-y-2`; título com `min-w-0`; ícone ao lado de título com
  descrição usa `items-start`; botões de ação com `flex-wrap`.
- Toolbars/filtros: `flex flex-wrap gap-2`; inputs `min-w-0 flex-1` — nunca somar larguras fixas >390px.
- Scroll horizontal de página é proibido (main é overflow-x-hidden) — scroll lateral só em containers
  explícitos (kanban, ScrollFade, tab bars com fade).
- Dialogs: `flex max-h-[90dvh] flex-col` + conteúdo `min-h-0 flex-1`.
- Toda tela nova: testar em 390px antes de mergear.
```

- [ ] **Step 5: Verificar**

`cd apps/dscar-web && npx tsc --noEmit` limpo. Playwright 390×844: `/os` — título não quebra mais com palavra órfã ao lado dos botões (PageHeader). Screenshot no report.

- [ ] **Step 6: Commit**

```bash
git add apps/dscar-web/src/components/ui/scroll-fade.tsx apps/dscar-web/src/components/ui/page-header.tsx "apps/dscar-web/src/app/(app)/layout.tsx" CLAUDE.md
git commit -m "feat(dscar): fundação do padrão responsivo — ScrollFade, PageHeader wrap, main sem scroll-x"
```

---

### Task 2: Lista de OS em cards (tela piloto — validação com o usuário)

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/_components/ServiceOrderTable.tsx` (auditoria parte 1, item /os #2 — `overflow-hidden` na linha 60)

**Interfaces:**
- Consumes: padrão-ouro `/financeiro/contas-pagar/page.tsx:236-320`; `ScrollFade` (Task 1).
- Produces: a referência de card de OS que as Tasks 6-8 vão imitar.

- [ ] **Step 1: Ler o padrão-ouro e a tabela atual**

Ler `financeiro/contas-pagar/page.tsx` (linhas 230-320) e `ServiceOrderTable.tsx` inteiro. Identificar as colunas atuais da tabela de OS (nº, status, cliente, placa/veículo, seguradora, valor, entrega — confirmar no código).

- [ ] **Step 2: Implementar cards mobile + manter tabela no desktop**

No `ServiceOrderTable.tsx`: envolver a tabela existente em `hidden md:block` (e trocar o wrapper `overflow-hidden` por `overflow-x-auto` — mesmo no desktop o corte é proibido). Adicionar bloco `md:hidden space-y-2` com um card por OS:

- Linha 1: `#numero` (mono, semibold) + badge de status (reusar o mesmo componente/config de badge da tabela) à direita
- Linha 2: nome do cliente (`text-sm`, truncate)
- Linha 3: `placa · veículo` (mono/muted, `text-xs`)
- Rodapé (border-t): seguradora (muted, truncate) + valor (mono, semibold) + data de entrega (mono, `text-xs`)
- Card inteiro clicável navegando pra OS (mesma navegação da linha da tabela — reusar handler existente)
- Empty state: manter o existente visível também no mobile

Estados visuais (hover/atrasada/etc.) que a tabela tenha: reaproveitar tokens/classes equivalentes no card. NÃO duplicar lógica de dados — os mesmos props/rows alimentam tabela e cards.

- [ ] **Step 3: Verificar**

tsc limpo. Playwright 390×844 logado: `/os` mostra cards com TODAS as informações da tabela (nada inacessível), tap num card navega pra OS. Desktop 1280px: tabela intacta. Screenshots (mobile + desktop) no report.

- [ ] **Step 4: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/os/_components/ServiceOrderTable.tsx"
git commit -m "feat(dscar): lista de OS em cards no mobile (padrão contas-a-pagar)"
```

---

### Task 3: Kanban — conter o scroll e liberar o header

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/kanban/page.tsx:48-53,108` (auditoria parte 1, /os/kanban)

**Interfaces:**
- Consumes: `overflow-x-hidden` global do main (Task 1) já contém o vazamento de página.

- [ ] **Step 1: Header com wrap**

Linha ~48: remover `shrink-0` do header e adicionar `flex-wrap gap-y-2`; linha ~53: grupo de botões ganha `flex-wrap`. Título+descrição com `min-w-0`.

- [ ] **Step 2: Affordance nas colunas**

No container das colunas (linha ~108, já tem `overflow-x-auto`): adicionar o fade de borda (envolver com `ScrollFade` se a estrutura permitir sem quebrar o DnD do @dnd-kit — se o DnD conflitar com o wrapper, adicionar só o `<div aria-hidden>` do fade posicionado manualmente e anotar no report).

- [ ] **Step 3: Verificar**

Playwright 390×844: página SEM scroll horizontal (só as colunas rolam); os 4 botões do header visíveis (em 2 linhas); fade visível na borda das colunas. Testar que o drag das colunas continua OK em desktop 1280px (arrastar um card se houver dado; senão, conferir ausência de erro no console). Screenshots no report.

- [ ] **Step 4: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/os/kanban/page.tsx"
git commit -m "fix(dscar): kanban mobile — header com wrap e scroll contido nas colunas"
```

---

### Task 4: Agenda — header do calendário responsivo

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/agenda/_components/CalendarHeader.tsx` (auditoria parte 1: botão Agendar em x=574px, `min-w-[200px]` fixo, zero breakpoints no arquivo)

- [ ] **Step 1: Reestruturar o header**

Ler o arquivo. Reorganizar em duas linhas com wrap: container raiz `flex flex-wrap items-center justify-between gap-2 py-3 px-1`. Grupo esquerdo (Anterior / mês / Próximo / Hoje): trocar `min-w-[200px]` do heading por `min-w-0` + `whitespace-nowrap` e reduzir pra `text-base` em mobile se necessário (`text-base sm:text-lg`). Grupo direito (seletor Mês/Semana/Dia + Agendar): `flex flex-wrap items-center gap-2`. Nenhuma mudança de comportamento — só layout.

- [ ] **Step 2: Verificar**

Playwright 390×844 em `/agenda`: botão "Agendar" e seletor Mês/Semana/Dia VISÍVEIS e clicáveis (clicar em "Semana" e ver a view mudar). Desktop 1280px: uma linha só, como antes. Screenshots no report.

- [ ] **Step 3: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/agenda/_components/CalendarHeader.tsx"
git commit -m "fix(dscar): header da agenda com wrap — Agendar e seletor de view acessíveis no mobile"
```

---

### Task 5: OS v2 — Fechamento, header sticky, Peças e scanner

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/ClosingTab.tsx:147-153,162-183,283-313`
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_v2/OSWorkspaceV2.tsx:101` (header sticky)
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/PartsTab.tsx` (wrapper da tabela)
- Modify: `apps/dscar-web/src/components/inventory/BarcodeScanInput.tsx:78-87`

**Interfaces:**
- Consumes: `ScrollFade` (Task 1).

- [ ] **Step 1: ClosingTab**

(a) Alerta (linha ~147): `flex items-center justify-between` → `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`; bloco de texto ganha `min-w-0 flex-1`. (b) KM de Saída (linha ~283): `grid grid-cols-2` → `grid grid-cols-1 gap-4 sm:grid-cols-2 items-end`; o `<Input>` no flex row ganha `min-w-0 flex-1`.

- [ ] **Step 2: Header do workspace v2 sem sticky no mobile**

`OSWorkspaceV2.tsx` linha ~101: `sticky top-0` → `md:sticky md:top-0` (no mobile o header rola junto, liberando ~230px de tela).

- [ ] **Step 3: PartsTab com ScrollFade**

Localizar o wrapper da tabela de peças (tem `overflow-auto` hoje) e envolver/trocar por `ScrollFade` — o fade passa a indicar as colunas Líquido/Custo/Margem à direita.

- [ ] **Step 4: BarcodeScanInput**

Input (linha ~78): adicionar `truncate` no className e encurtar o placeholder pra "Bipe ou digite o código..." (mobile-friendly).

- [ ] **Step 5: Verificar**

Playwright 390×844 em `/os/9999`: Fechamento (alerta em coluna, input KM legível), Peças (fade na tabela), Estoque (placeholder ok), e rolar a Visão Geral confirmando que o header sobe junto. Screenshots no report.

- [ ] **Step 6: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/os/[numero]/" apps/dscar-web/src/components/inventory/BarcodeScanInput.tsx
git commit -m "fix(dscar): OS v2 mobile — fechamento em coluna, header sem sticky, fade em peças"
```

---

### Task 6: Compras — KPIs e tabelas em cards

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/compras/page.tsx:226,232,243`
- Modify: `apps/dscar-web/src/app/(app)/compras/ordens/page.tsx:199`

**Interfaces:**
- Consumes: padrão de card da Task 2 (ler o `ServiceOrderTable.tsx` já convertido), `ScrollFade`.

- [ ] **Step 1: KPIs de /compras**

Linhas 226 e 232: `grid grid-cols-4 gap-4` → `grid grid-cols-2 gap-3 lg:grid-cols-4`.

- [ ] **Step 2: Tabela "OS com peças" em cards**

Linha 243 (`overflow-hidden`): converter pro padrão tabela `hidden md:block` (com `overflow-x-auto`) + cards `md:hidden`: linha 1 = nº da OS (mono) + badge de status; linha 2 = veículo (truncate); rodapé = tipo + contagem de peças + botão de ação (o mesmo da coluna Ação, full-width no card). Empty state visível no mobile.

- [ ] **Step 3: Tabela de ordens de compra em cards**

`compras/ordens/page.tsx:199`: mesmo tratamento — card com nº da OC + badge status; OS vinculada; rodapé = valor total (mono) + contagem de itens. Empty state ("Nenhuma ordem de compra encontrada") fora do wrapper cortado, centralizado e visível no mobile.

- [ ] **Step 4: Verificar**

Playwright 390×844: `/compras` (KPIs em 2 colunas com labels inteiros; tabela → cards ou empty state íntegro) e `/compras/ordens` (idem). Screenshots no report.

- [ ] **Step 5: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/compras/"
git commit -m "fix(dscar): compras mobile — KPIs 2 colunas e tabelas em cards"
```

---

### Task 7: Fiscal + Estoque — KPIs, tabela de documentos e ícones de header

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/fiscal/documentos/page.tsx:775,817` (+ header icon)
- Modify: `apps/dscar-web/src/app/(app)/fiscal/resumo/page.tsx` (header icon)
- Modify: `apps/dscar-web/src/app/(app)/estoque/page.tsx` (header icon)

- [ ] **Step 1: KPIs de fiscal/documentos**

Linha 775: `grid grid-cols-3 gap-3` → `grid grid-cols-2 gap-3 sm:grid-cols-3` (labels "Aguardando"/"Autorizadas"/"Rejeitadas" inteiros no mobile).

- [ ] **Step 2: Tabela de documentos fiscais em cards**

Linha 817 (`overflow-hidden`): padrão tabela `hidden md:block` + cards `md:hidden`: linha 1 = tipo do documento + badge de status; linha 2 = referência/número (mono, truncate); rodapé = valor (mono). Empty state visível no mobile.

- [ ] **Step 3: Ícones de header alinhados**

Nos headers de `/estoque`, `/fiscal/resumo` e `/fiscal/documentos` (auditoria parte 2 aponta o padrão `flex items-center gap-3` com texto de 2 linhas): trocar `items-center` por `items-start` e dar `mt-0.5` no ícone se precisar de ajuste ótico. Se as 3 telas usarem o mesmo componente compartilhado, corrigir só nele (verificar com grep antes).

- [ ] **Step 4: Verificar**

Playwright 390×844: `/fiscal/documentos` (KPIs 2 col, cards/empty íntegro, ícone alinhado), `/fiscal/resumo` e `/estoque` (ícones). Screenshots no report.

- [ ] **Step 5: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/fiscal/" "apps/dscar-web/src/app/(app)/estoque/page.tsx"
git commit -m "fix(dscar): fiscal/estoque mobile — KPIs responsivos, documentos em cards, ícones alinhados"
```

---

### Task 8: Orçamentos, cadastros e retoques de contas-a-pagar

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/orcamentos-particulares/page.tsx:103,121,150`
- Modify: `apps/dscar-web/src/app/(app)/cadastros/page.tsx` (fileira de tabs)
- Modify: `apps/dscar-web/src/app/(app)/financeiro/contas-pagar/page.tsx` (2 cosméticos)

- [ ] **Step 1: Orçamentos particulares**

(a) Linha 103: `grid grid-cols-4 gap-4` → `grid grid-cols-2 gap-3 sm:grid-cols-4`. (b) Linha 121: `flex gap-3` → `flex flex-col gap-3 sm:flex-row`; input de busca com `min-w-0` (manter `sm:max-w-xs`). (c) Linha 150: trocar o wrapper `overflow-hidden` da tabela pelo padrão cards `md:hidden` (linha 1 = nº + badge de versão; linha 2 = cliente truncate; rodapé = placa mono) com tabela `hidden md:block`.

- [ ] **Step 2: Tabs de cadastros roláveis**

Na fileira de tabs de `/cadastros` (Todos/Clientes/Fornecedores/Funcionários/...): envolver com `ScrollFade` (tabs ganham `whitespace-nowrap`).

- [ ] **Step 3: Contas-a-pagar cosméticos**

(a) Placeholder da busca → "Buscar fornecedor..." (curto). (b) Linha do filtro de datas: garantir `flex flex-wrap items-center gap-2` no container ("Venc. de" sem quebra no meio: `whitespace-nowrap` no label).

- [ ] **Step 4: Verificar**

Playwright 390×844: `/orcamentos-particulares` (KPIs 2 col, busca+select empilhados, cards), `/cadastros` (tabs roláveis com fade), `/financeiro/contas-pagar` (filtros limpos). Screenshots no report.

- [ ] **Step 5: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/orcamentos-particulares/page.tsx" "apps/dscar-web/src/app/(app)/cadastros/page.tsx" "apps/dscar-web/src/app/(app)/financeiro/contas-pagar/page.tsx"
git commit -m "fix(dscar): orçamentos/cadastros/contas-a-pagar mobile — KPIs, filtros e cards"
```

---

### Task 9: Verificação final — re-auditoria das 22 telas + suítes

**Files:** nenhum novo (correções pontuais se a re-auditoria achar regressão).

- [ ] **Step 1: Suítes**

`cd apps/dscar-web && npx vitest run && npx tsc --noEmit && npm run build` — tudo verde (132+ testes; build webpack).

- [ ] **Step 2: Re-auditoria Playwright**

Repetir o roteiro das duas auditorias (mesmas 22 telas, 390×844): dashboard, /os, /os/kanban, /os/9999 (todas as seções), /agenda, /orcamentos, /orcamentos-particulares, /cadastros, /cadastros/seguradoras, /estoque, /estoque/produtos/pecas, /estoque/movimentacoes, /compras, /compras/ordens, /financeiro, /financeiro/contas-pagar, /financeiro/dre, /fiscal/resumo, /fiscal/documentos, /rh/colaboradores, /rh/ponto, /configuracoes. Critério de aprovação: **zero problema "quebrado" e zero "ruim"** remanescente dos relatórios originais, e nenhuma regressão nova (checar especialmente que o `overflow-x-hidden` global não cortou nada legítimo). Registrar o resultado por tela em `.superpowers/sdd/mobile-reaudit.md`.

- [ ] **Step 3: Push**

Somente após critério atendido: `git push origin main` (frontend-only — Vercel builda sozinho; sem passo na VM).
