# Restyle Mobile "Mistura Densa" — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o restyle denso aprovado (mock `~/Downloads/direcao-final-dscar.html`) — densidade mobile nativa, alinhamento em colunas, faixa de status, KPIs em régua — via tokens e componentes compartilhados.

**Architecture:** Fundação primeiro (gutters + PageHeader + SectionLabel + regras no CLAUDE.md), depois KpiStrip + dashboard, depois o card de OS como piloto da receita de card denso, depois réplica nas 4 listas restantes. Desktop intacto (exceção deliberada: KpiStrip).

**Tech Stack:** Next.js 15 + Tailwind v3 (tema escuro, tokens existentes), Playwright pra verificação visual.

**Spec:** `docs/superpowers/specs/2026-07-14-mobile-dense-restyle-design.md` (LER antes de cada task — os princípios numerados 1-8 são as regras de implementação)

## Global Constraints

- Mobile = `< md`. Desktop NÃO muda (exceto KpiStrip `md:grid-cols-4`).
- **PROIBIDO `justify-between` em rodapé de card de lista** — grid de colunas fixas sempre (`grid grid-cols-[minmax(0,1fr)_96px_44px] gap-2.5 items-baseline`, texto flexível com `truncate`, colunas de valor/data com `text-right`).
- Dados (valores, placas, datas, ids) em `font-mono tabular-nums`.
- Cards de lista: sem border no mobile, `rounded-[11px]`, padding `px-3 py-2.5` aprox, faixa de status 3px via pseudo-elemento ou `border-l`? — usar span absoluto (`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px]` + cor do status) porque border-l não tem inset vertical.
- Paridade de dados dos cards NÃO regride: os campos existentes continuam todos (a receita muda o layout, não remove dado). Ações (Faturar OS etc.) permanecem, com alvo ≥44px.
- Design tokens/`SERVICE_ORDER_STATUS_CONFIG` — nunca cores brutas novas (se precisar de tom de superfície, criar token no tema).
- `active:scale-[0.98]`, stagger (`animate-card-in`) e a11y (role/tabIndex/onKeyDown guard) dos cards atuais são PRESERVADOS na reescrita.
- Gates por task: `cd apps/dscar-web && npx tsc --noEmit` + vitest verde + verificação visual Playwright 390×844 E 1280px (login admin@paddock.solutions/admin123, dev server http://localhost:3001), screenshots no report.
- Conventional commits pt-BR.
- Reports em `.superpowers/sdd/restyle-<task>-report.md`.

---

### Task R1: Fundação de densidade — gutters, PageHeader, SectionLabel, CLAUDE.md

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/layout.tsx` (main: `px-3` → `px-2 md:px-6`; manter o resto)
- Modify: TODAS as páginas com container `p-3 md:p-6` (sed da sprint anterior): trocar por `px-0 py-3 md:p-6` (mobile fica só com o gutter do layout, ~8px; desktop igual). Padrão de sed: `className="p-3 md:p-6` → `className="px-0 py-3 md:p-6` e `className="flex flex-col gap-6 p-3 md:p-6` → `className="flex flex-col gap-4 md:gap-6 px-0 py-3 md:p-6` (gap entre seções também aperta no mobile).
- Modify: `apps/dscar-web/src/components/ui/page-header.tsx` — título `text-xl md:text-2xl` (era text-2xl fixo; conferir o atual), subtítulo `mt-0.5 text-xs md:text-sm`.
- Create: `apps/dscar-web/src/components/ui/section-label.tsx`:

```tsx
import { cn } from "@/lib/utils"

/** Eyebrow de seção — barato em altura, organiza sem card em volta. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground",
        "after:h-px after:flex-1 after:bg-border",
        className,
      )}
    >
      {children}
    </p>
  )
}
```

- Modify: `CLAUDE.md` — na seção "Responsividade Mobile", adicionar:

```markdown
- Densidade mobile: gutter total ~8-10px (layout px-2 + páginas px-0 no mobile); gap entre cards
  space-y-2; padding interno de card px-3 py-2.5.
- Rodapé/linha de dados de card de lista: SEMPRE grid de colunas fixas
  (`grid-cols-[minmax(0,1fr)_96px_44px]`, texto trunca, valor/data text-right) — PROIBIDO
  justify-between (valores flutuam conforme o vizinho).
- Card de lista mobile: sem border (superfície por tom), rounded-[11px], faixa de status 3px à
  esquerda, status como texto colorido (sem pill), dados em font-mono tabular-nums.
```

**Steps:** implementar → tsc + vitest → Playwright: /os e /dashboard em 390px (gutter visivelmente menor, título compacto) e 1280px (desktop igual) → commit `feat(dscar): restyle denso — fundação de densidade mobile e regras de alinhamento`.

---

### Task R2: KpiStrip + dashboard

**Files:**
- Create: `apps/dscar-web/src/components/ui/kpi-strip.tsx`:

```tsx
import { cn } from "@/lib/utils"

export interface KpiItem {
  label: string
  value: string
  icon: React.ReactNode
  /** classes da pastilha, ex: "bg-success-500/10 text-success-400" */
  iconClass: string
  /** destaca o valor (ex: alerta) — classes no valor */
  valueClass?: string
}

/** Régua contínua de KPIs — células divididas por 1px, pastilha + label + valor mono. */
export function KpiStrip({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border md:grid-cols-4", className)}>
      {items.map((kpi) => (
        <div key={kpi.label} className="flex items-center gap-2.5 bg-card px-3 py-2.5">
          <span className={cn("flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-sm", kpi.iconClass)}>
            {kpi.icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] leading-tight text-muted-foreground">{kpi.label}</span>
            <span className={cn("block font-mono text-[17px] font-semibold leading-tight tabular-nums", kpi.valueClass)}>
              {kpi.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
```

(Se `bg-card` não contrastar com o fundo como no mock, ajustar pro token de superfície da spec.)

- Modify: dashboard (`src/app/(app)/dashboard/` — page + ManagerDashboard/ConsultantDashboard e `StatCard.tsx` conforme o uso real): substituir o grid de StatCards da "Visão Geral" por `KpiStrip` (labels curtos: "Faturamento", "Entregas", "Ticket médio", "Atrasadas"; ícones e cores semânticas atuais; valor de atrasadas com `valueClass="text-error-400"` quando > 0). Se StatCard for usado em outras telas, NÃO apagar o componente — só o dashboard migra nesta task.
- Modify: seções do dashboard ("VISÃO GERAL", "FATURAMENTO", "EQUIPE") → `SectionLabel`.

**Steps:** implementar → gates → Playwright 390 e 1280 do dashboard (régua em 2 col mobile / 4 col desktop) → commit `feat(dscar): restyle denso — KpiStrip e dashboard compacto`.

---

### Task R3: Card de OS denso (piloto da receita)

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/_components/ServiceOrderTable.tsx` — REESCREVER só o bloco do card mobile (`md:hidden`) seguindo o mock:
  - Superfície: `bg-card rounded-[11px] px-3 py-2.5` SEM border; faixa: `<span aria-hidden className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r-[3px]", statusCfg.dot)} />` (card com `relative`).
  - Linha 1: `#numero` mono 13px roxo (`text-primary`) + ` · placa` mono muted na MESMA linha; status à direita como texto (`text-[11px] font-semibold` + cor do status — usar a cor de texto do config; se o config só tem badge/dot, extrair a cor de texto equivalente).
  - Linha 2: cliente `text-[13.5px] font-medium truncate`.
  - Linha 3 (rodapé): grid `grid-cols-[minmax(0,1fr)_96px_44px] gap-2.5 items-baseline font-mono text-[11.5px] tabular-nums text-muted-foreground` → seguradora truncada · valor `text-right text-foreground font-semibold text-[12.5px]` · data Prev `text-right` (destacada em error quando atrasada). Entr sai da linha principal e vai junto da data? NÃO — manter paridade: `Entr` + `Prev` juntas na coluna de data (`Entr 06/07·Prev 18/07` não cabe em 44px — usar coluna de data de 96px também: grid `[minmax(0,1fr)_88px_96px]` com "Entr 06/07" na linha de cima e "Prev 18/07" embaixo, ou datas empilhadas). DECISÃO: coluna de data única de ~92px com as duas datas empilhadas (`flex flex-col items-end leading-tight`), Prev destacada quando atrasada.
  - Faturamento: botão "Faturar OS"/indicador "Faturada" continua abaixo do rodapé quando aplicável (min-h-11 preservado), alinhado à direita.
  - PRESERVAR: navegação (role/tabIndex/onKeyDown guard), stopPropagation no botão, `animate-card-in`, `active:scale-[0.98]`, skeleton mobile (ajustar shape pro card novo), stagger.
  - Lista: `space-y-2`.
  - Tabela desktop: INTOCADA.

**Steps:** implementar → gates → Playwright 390: screenshot + MEDIR alinhamento via DOM (borda direita do valor de 2+ cards na mesma coordenada X) + contar cards visíveis (~6-7 na viewport com dados reais de dev = 1 OS, então medir altura do card ≤ ~96px) → desktop 1280 intacto → commit `feat(dscar): restyle denso — card de OS piloto`.

---

### Task R4: Réplica nas listas (compras ×2, fiscal, orçamentos) + KPIs desses módulos

**Files:**
- Modify: `compras/page.tsx`, `compras/ordens/page.tsx`, `fiscal/documentos/page.tsx`, `orcamentos-particulares/page.tsx`:
  - Cards mobile: aplicar a receita do piloto R3 (ler o ServiceOrderTable.tsx FINAL antes) — faixa com a cor de status do domínio (status de pedido/OC/documento fiscal/orçamento — mapear das configs/badges existentes de cada tela), rodapé em grid de colunas fixas (adaptar colunas ao conteúdo de cada card, mantendo valor/data em colunas fixas à direita), superfície sem border, mono tabular, paridade de dados intacta.
  - KPIs de `/compras` e `/fiscal/documentos` e `/orcamentos-particulares` → `KpiStrip` (labels curtos onde for só apresentação).
  - Eyebrows onde houver títulos de seção → `SectionLabel`.

**Steps:** implementar → gates → Playwright 390 das 4 telas (+ 1280 sem regressão) → commit `feat(dscar): restyle denso — listas de compras, fiscal e orçamentos`.

---

### Task R5: Verificação final e push

- Suítes completas (vitest, tsc) + `npm run build`.
- Playwright sweep 390×844: dashboard, /os, /compras, /compras/ordens, /fiscal/documentos, /orcamentos-particulares, /agenda, /os/9999 — sem regressão estrutural (nada estourando, alvos ≥44px), screenshots.
- Desktop 1280: dashboard (KpiStrip 4 col — única mudança esperada), /os (tabela intacta).
- `git push origin main` e confirmar deploy Ready no Vercel (`npx vercel ls` de apps/dscar-web; se o webhook não disparar em ~3min, commit vazio pra reativar — aconteceu 2x ontem).
