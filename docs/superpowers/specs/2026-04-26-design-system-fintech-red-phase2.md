# Design System Fintech-Red Phase 2 — Full ERP Sweep

**Data:** 2026-04-26
**Autor:** Thiago + Claude
**Prerequisito:** Phase 1 completa (commits `91b4642`..`fd81d45`)

## Objetivo

Aplicar a estética fintech-liquidity (terminal seletivo) em **todas** as páginas do ERP dscar-web. Abordagem top-down: criar/refinar 6 componentes foundation, depois migrar ~40 páginas para consumi-los.

## Decisões de Design

- **Nível de fidelidade:** Terminal seletivo — padrões úteis (label-mono, section-dividers, data cards, status dots) sem animações pesadas (beam-spin, marquee, float)
- **Escopo:** Todas as páginas — Dashboard, OS, Cadastros, Financeiro, RH, Motor, Estoque, Orçamentos, Fiscal, Benchmark, Agenda
- **Sidebar:** Refinamento sutil — section-dividers + label-mono nos badges, sem redesign estrutural
- **Abordagem:** Componentes compartilhados primeiro (top-down), depois migração página por página

---

## Layer 1: Componentes Foundation

### 1. `DataTable` — Wrapper dark para `<Table>` shadcn

**Arquivo:** `src/components/ui/data-table.tsx`

Wrapper que aplica dark theme automaticamente no `<Table>` do shadcn. Recebe children normais (`<TableHeader>`, `<TableBody>`, etc.) mas injeta as classes dark.

```
Container:   bg-white/5 rounded-md border border-white/10 overflow-hidden
Header row:  bg-white/[0.03] border-b border-white/10
Header cells: label-mono text-white/40
Body rows:   hover:bg-white/[0.03] transition-colors
Body text:   text-white/90 (primary), text-white/60 (secondary)
Empty state: text-white/30 centralizado, "Nenhum registro encontrado"
```

Props:
- `children` — conteúdo normal da tabela
- `emptyMessage?: string` — mensagem quando sem dados
- `className?: string` — override do container

### 2. `StatCard` — Refatorar existente

**Arquivo:** `src/components/ui/stat-card.tsx` (modificar)

Mudanças:
- Icon container: `bg-white/[0.06] rounded-md` (substituir `bg-success-50`, `bg-info-50` etc.)
- Icon color: mantém cor semântica (`text-success-400`, `text-info-400`, etc.)
- Value: adicionar `font-mono` ao valor numérico (estilo data card fintech)
- Label: trocar para `label-mono text-white/40` (era `text-white/50 uppercase tracking-wide`)
- Trend: `label-mono text-success-400` (up) ou `label-mono text-error-400` (down)

### 3. `StatusPill` — Badge dark genérico

**Arquivo:** `src/components/ui/status-pill.tsx` (novo)

Para status que não são de OS (financeiro, RH, estoque, etc.). O `StatusBadge` existente é específico para `ServiceOrderStatus`.

```tsx
interface StatusPillProps {
  label: string
  color: "success" | "error" | "warning" | "info" | "neutral"
  size?: "sm" | "md"
  dot?: boolean        // ponto pulsante antes do label
  className?: string
}
```

Renderização:
- `bg-{color}-500/10 border border-{color}-500/20 text-{color}-400`
- Se `dot`: ponto `h-1.5 w-1.5 rounded-full bg-{color}-400 animate-pulse-slow` antes do label
- Size `sm`: `px-2 py-0.5 text-xs`, `md`: `px-2.5 py-1 text-sm`

Color map:
- `success` → `success-500/success-400`
- `error` → `error-500/error-400`
- `warning` → `warning-500/warning-400`
- `info` → `info-500/info-400`
- `neutral` → `white/10, white/20, white/50`

### 4. `FormField` tokens — Padronizar

**Arquivo:** `packages/utils/src/form-styles.ts` (modificar)

Atualizar constantes existentes para linguagem fintech:

```typescript
export const FORM_LABEL = "label-mono text-white/50"
export const FORM_INPUT = "bg-white/[0.03] border-white/10 text-white placeholder:text-white/20 focus:border-primary-500/50 focus:ring-primary-500/20"
export const FORM_HINT = "text-xs text-white/30 font-mono"
export const FORM_ERROR = "text-xs text-error-400 font-mono"
export const FORM_SECTION_TITLE = "text-sm font-semibold text-white/70"
```

### 5. Sidebar refinada

**Arquivo:** `src/components/Sidebar.tsx` (modificar)

Mudanças pontuais:
- Section headers (CADASTROS, FINANCEIRO, etc.): trocar de `text-xs font-semibold uppercase text-white/40` para a classe `section-divider` (com a linha `::after`)
- Badge counts nos items: adicionar `font-mono` (ex: count de OS abertas)
- Sem mudanças estruturais

### 6. `PageShell` — Padrão documentado (não componente)

Toda página `(app)/*` segue este layout:
```tsx
<PageHeader title="..." description="..." actions={...} />
<SectionDivider label="PRIMEIRA SEÇÃO" />
{/* conteúdo */}
<SectionDivider label="SEGUNDA SEÇÃO" />
{/* conteúdo */}
```

Não é um componente wrapper — é o padrão que cada página adota individualmente. `PageHeader` e `SectionDivider` já existem da Phase 1.

---

## Layer 2: Mapa de Migração por Módulo

### Dashboard (`/dashboard`) — 4 arquivos
| Arquivo | Mudança |
|---------|---------|
| `_components/StatCard.tsx` | Refatorar (Foundation #2) |
| `_components/OverdueOSList.tsx` | `bg-red-50` → `bg-error-500/10`, `border-red-100` → `border-error-500/20`, `text-red-700` → `text-error-400`, `bg-red-50` header → `bg-error-500/5` |
| `_components/TeamProductivityTable.tsx` | `border-neutral-100` → `border-white/10`, `text-success-700` → `text-success-400` |
| `_components/RecentOSTable.tsx` | `border-neutral-100` → `border-white/10` |

### OS (`/service-orders`) — 5+ arquivos
| Arquivo | Mudança |
|---------|---------|
| List + Kanban | Já migrados Phase 1 — verificar apenas |
| `[id]/_components/ServiceOrderForm.tsx` | Tabs internas: `SectionDivider` por seção |
| `[id]/_components/tabs/*.tsx` | `FormField` tokens em inputs |
| `[id]/_components/sections/*.tsx` | `FormField` tokens, `label-mono` em labels |
| `_components/NewOSDrawer.tsx` | `FormField` tokens nos inputs do drawer |

### Cadastros (`/cadastros`) — 10+ arquivos
| Arquivo | Mudança |
|---------|---------|
| Pessoas (PersonTable) | **Migração completa light→dark**: `bg-white` → `bg-white/5`, `text-neutral-*` → `text-white/*`, `border-neutral-*` → `border-white/10`, pills `bg-emerald-100` → `StatusPill` |
| Seguradoras | `PageHeader` + `DataTable` |
| Serviços | `PageHeader` + `DataTable` |
| Catálogo (7 páginas) | `PageHeader` + `DataTable` + `label-mono` |
| Fichas Técnicas | `DataTable` + formulário com `FormField` tokens |
| Corretores | `DataTable` |
| Especialistas | `DataTable` |

### Financeiro (`/financeiro`) — 8+ arquivos
| Arquivo | Mudança |
|---------|---------|
| Dashboard | `StatCard` refatorado |
| `JournalEntryTable` | Badges `bg-red-100 text-red-700` → `StatusPill`, `border-neutral-100` → `border-white/10` |
| Plano de Contas | Árvore hierárquica: verificar/corrigir dark tokens |
| AP lista + novo + detalhe | `DataTable` + `StatusPill` + `FormField` tokens |
| AR lista + novo + detalhe | `DataTable` + `StatusPill` + `FormField` tokens |
| `RecordPaymentDialog` / `RecordReceiptDialog` | `FormField` tokens |

### RH (`/rh`) — 10+ arquivos
| Arquivo | Mudança |
|---------|---------|
| Dashboard | `StatCard` refatorado |
| EmployeeTable | `label-mono` nos headers |
| Admissão (novo) | `FormField` tokens |
| Detalhe (6 tabs) | `FormField` tokens + `SectionDivider` |
| Ponto + Espelho | `DataTable` + `PageHeader` |
| Metas | `DataTable` + `StatusPill` |
| Vales (3 tabs) | `DataTable` + `StatusPill` |
| Folha + Detalhe + Contracheque | `DataTable` + `PageHeader` + `StatusPill` |

### Motor (`/configuracao-motor`) — 6+ arquivos
| Arquivo | Mudança |
|---------|---------|
| Margens (2 abas) | `DataTable` + `FormField` tokens |
| Snapshots lista + detalhe | `DataTable` + `PageHeader` |
| Simulador | `FormField` tokens |
| Custos (4 abas) | `DataTable` + `FormField` tokens |
| Impressoras | `DataTable` |
| Variâncias | `DataTable` + `StatusPill` alertas |

### Capacidade + Auditoria — 3 arquivos
| Arquivo | Mudança |
|---------|---------|
| Capacidade (heatmap) | Cores heatmap → tokens semânticos + `PageHeader` |
| Variâncias | `DataTable` + `StatusPill` |
| Auditoria Motor | `StatCard` KPIs + `DataTable` |

### Estoque (`/estoque`) — 5 arquivos
| Arquivo | Mudança |
|---------|---------|
| Dashboard | Links + `PageHeader` |
| Unidades | `DataTable` + `PageHeader` |
| Lotes | `DataTable` + barra saldo com tokens |
| NF-e lista + detalhe | `DataTable` + `StatusPill` |

### Orçamentos (`/orcamentos`) — 3 arquivos
| Arquivo | Mudança |
|---------|---------|
| Lista | `DataTable` + `PageHeader` + `StatCard` KPIs |
| Novo | `FormField` tokens |
| Detalhe | `SectionDivider` por área + `StatusPill` |

### Fiscal (`/fiscal`) — 3 arquivos
| Arquivo | Mudança |
|---------|---------|
| Documentos Emitidos | `DataTable` + `StatCard` KPIs |
| NF-e Recebidas | `DataTable` + `StatusPill` |
| Emitir NFS-e | `FormField` tokens |

### Benchmark (`/benchmark`) — 4 arquivos
| Arquivo | Mudança |
|---------|---------|
| Fontes | `DataTable` + `FormField` inline |
| Ingestões | `DataTable` + `StatusPill` |
| Revisão (split) | Dark theme no painel lateral |
| Estatísticas | `DataTable` + `StatCard` KPIs |

### Agenda (`/agenda`) — 2 arquivos
| Arquivo | Mudança |
|---------|---------|
| Views (Mês/Semana/Dia) | Verificar células + cards usam dark tokens |
| SchedulingDialog | `FormField` tokens |

---

## Regras do Sweep (contrato inviolável)

### Cores proibidas → substituições
| Proibido | Substituir por |
|----------|---------------|
| `bg-white` (sólido) | `bg-card` ou `bg-white/[0.04]` |
| `bg-neutral-50`, `bg-neutral-100` | `bg-white/[0.03]` |
| `border-neutral-100`, `border-neutral-200` | `border-white/10` |
| `divide-neutral-*` | `divide-white/5` |
| `text-neutral-900` | `text-white/90` |
| `text-neutral-700` | `text-white/70` |
| `text-neutral-500`, `text-neutral-600` | `text-white/50` ou `text-white/40` |
| `text-neutral-400` | `text-white/30` |
| `bg-emerald-*` | `bg-success-*/10` com opacity |
| `bg-red-50/100`, `text-red-700` | `bg-error-500/10`, `text-error-400` |
| `bg-indigo-*` | `bg-white/5` ou `bg-info-500/10` |
| `bg-blue-50`, `border-blue-*` | `bg-info-500/10`, `border-info-500/20` |
| `text-red-600/700` (badge context) | `text-error-400` |
| `text-emerald-700` (badge context) | `text-success-400` |

### Tipografia fintech (aplicar em todo arquivo tocado)
- Cabeçalhos de tabela: `label-mono text-white/40`
- Section labels: `<SectionDivider label="NOME" />`
- Valores numéricos grandes (KPIs, totais): `font-mono font-bold text-white`
- Timestamps / metadata: `text-xs text-white/30 font-mono`
- Form labels: `label-mono text-white/50`

### Badges (qualquer módulo)
- Nunca fundo sólido light (`bg-red-100`, `bg-green-100`, `bg-emerald-100`)
- Sempre: `bg-{color}-500/10 border border-{color}-500/20 text-{color}-400`
- OS: usar `StatusBadge` (existente)
- Outros módulos: usar `StatusPill` (novo)

### Imports
- Nunca importar de `@/lib/design-tokens` (legado) → sempre `@paddock/utils`
- Tabelas: usar `<DataTable>` wrapper → nunca montar `<Table>` com styling inline repetido

---

## Fora de Escopo

- Animações pesadas (beam-spin, marquee, float, col-anim)
- Status bar fake (`SYS.ONLINE · LATENCY: 32MS`)
- Redesign estrutural da sidebar (só refinamento de labels)
- Mudanças em lógica de negócio ou APIs
- Componentes mobile (`apps/mobile/`)
- Páginas de auth (`/login`) — tema gerenciado pelo Keycloak

---

## Estimativa de Escopo

- **Foundation (Layer 1):** 6 componentes → ~6 arquivos criados/modificados
- **Migração (Layer 2):** ~40 páginas → ~50-60 arquivos modificados
- **Total:** ~60-66 arquivos
- **Ordem de execução:** Foundation primeiro, depois módulo por módulo (Dashboard → OS → Cadastros → Financeiro → RH → Motor → Estoque → Orçamentos → Fiscal → Benchmark → Agenda)
