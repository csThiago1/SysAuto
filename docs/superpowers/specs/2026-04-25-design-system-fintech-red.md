# Design System — Fintech-Liquidity Red Adaptation
**Data:** 2026-04-25
**Status:** Aprovado
**Escopo:** `apps/dscar-web` — ERP DS Car

---

## Visão Geral

Adaptação do design system `design_system/design-system.html` (estética "fintech-liquidity" terminal) para o `dscar-web`. A única diferença em relação ao original: o acento lime-400 (#a3e635) é substituído por um tom sutil de vermelho (#cc4444).

O objetivo é adicionar densidade visual e caráter profissional ao ERP sem alterar lógica de negócio, performance ou estrutura de dados.

---

## Decisões de Design

### Acento Vermelho

| Uso | Cor | Token |
|-----|-----|-------|
| Labels mono, section markers, status dots | `#cc4444` | `primary-500` (var existente) |
| CTAs, botões de ação | `#ea0e03` | `primary-600` — **sem mudança** |
| Hover de labels | `#ff6b6b` | `primary-400` — **sem mudança** |

O `#cc4444` é mais escuro e muted que o `primary-400` (#ff6b6b), criando subtileza. Nenhum token existente é removido ou renomeado.

### Sistema de Dois Padrões

**Regra central:** cada padrão tem um papel único. Nunca são usados simultaneamente no mesmo nível.

#### `PageHeader` — âncora de navegação
- Aparece **uma vez por página**, no topo
- Fonte Montserrat, título apenas
- Sem eyebrow mono acima (evita "Ordens de Serviço / Ordens de Serviço")
- Pode ter `description` subtítulo em cinza

```
Dashboard
```

#### `SectionDivider` — organização de conteúdo
- Aparece **dentro do conteúdo** da página, entre blocos distintos
- Padrão: `LABEL ──────────────` em mono uppercase
- Cor: `#cc4444` (acento vermelho muted)
- Usado apenas quando há múltiplos blocos que precisam de separação visual

```
VISÃO GERAL ──────────────────────
```

**Aplicação por página:**

| Página | PageHeader | SectionDivider |
|--------|-----------|----------------|
| Dashboard | "Dashboard" | "VISÃO GERAL", "OS RECENTES" |
| OS List | "Ordens de Serviço" | nenhum (página plana) |
| Kanban | "Kanban" | nenhum (página plana) |

---

## Layer 1 — Componentes Foundation

### 1. `globals.css` — Utilitários novos

**`.label-mono`** — label terminal padrão:
```css
.label-mono {
  font-size: 10px;
  font-family: var(--font-mono, ui-monospace, monospace);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #cc4444;
}
```

**`.section-divider`** — linha divisória com label:
```css
.section-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #cc4444;
  font-size: 10px;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
}
```

### 2. `tailwind.config.ts` — Animação nova

Adicionar ao bloco `extend.animation`:
```
'pulse-slow': 'pulse-slow 4s ease-in-out infinite',
```

Adicionar ao bloco `extend.keyframes`:
```
'pulse-slow': {
  '0%, 100%': { opacity: '1' },
  '50%': { opacity: '0.4' },
},
```

### 3. `card.tsx` — Fix dark theme

**Problema:** `bg-white border-neutral-200` → card branco em fundo escuro (#0a0a0a).
**Fix:** usar variáveis CSS já existentes no projeto.

```
bg-card border-white/10
```

O token `--card: 0 0% 7%` já existe em `globals.css`. Apenas o className muda — nenhum token novo é necessário.

### 4. `page-header.tsx` — Sem eyebrow

O componente atual já é limpo. Nenhum eyebrow mono deve ser adicionado. A modificação é apenas garantir que o título use `text-foreground` (não `text-neutral-900`, que é claro demais no dark theme):

```tsx
<h2 className="text-2xl font-semibold tracking-tight text-foreground">
```

### 5. `status-badge.tsx` — Variante com dot pulsante

Adicionar prop `variant?: 'default' | 'dot'`. Quando `variant='dot'`:

```tsx
<span className="flex items-center gap-1.5">
  <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse-slow", dotColor)} />
  <span className="label-mono">{label}</span>
</span>
```

O `dotColor` segue o mesmo mapeamento de status existente (verde para open, amarelo para em progresso, etc.), mas usando os tokens `success-500`, `warning-500`, `error-500` já presentes no Tailwind config.

### 6. Novo componente `SectionDivider`

Criar em `src/components/ui/section-divider.tsx`:

```tsx
interface SectionDividerProps {
  label: string
  className?: string
}

export function SectionDivider({ label, className }: SectionDividerProps) {
  return (
    <div className={cn("section-divider", className)}>
      {label}
    </div>
  )
}
```

---

## Layer 2 — Páginas

### Dashboard (`/dashboard`)

**Estrutura:**
```
PageHeader: "Dashboard"
SectionDivider: "VISÃO GERAL"
  → Metrics grid: 4 cards em grid divide-x divide-white/5
SectionDivider: "OS RECENTES"
  → Tabela OS
```

**Metrics grid pattern:**
```tsx
<div className="grid grid-cols-4 divide-x divide-white/5 border border-white/5 rounded-md">
  {metrics.map(m => (
    <div className="px-6 py-4">
      <div className="label-mono mb-2">{m.label}</div>
      <div className="text-2xl font-semibold font-mono">{m.value}</div>
    </div>
  ))}
</div>
```

Aplica-se tanto ao `ManagerDashboard` (4 KPIs) quanto ao `ConsultantDashboard` (KPIs pessoais).

### OS List (`/service-orders`)

**Estrutura:**
```
PageHeader: "Ordens de Serviço" + description "N resultados"
  → Filtros
  → Tabela
```

Sem `SectionDivider` — página plana com uma única seção de conteúdo.

**Cabeçalhos da tabela:** usar `.label-mono` em vez de texto normal:
```tsx
<th className="label-mono px-4 py-2">STATUS</th>
<th className="label-mono px-4 py-2">CLIENTE</th>
```

**Status na tabela:** usar `StatusBadge variant='dot'` para todas as ocorrências na lista.

### Kanban (`/service-orders/kanban`)

**Estrutura:**
```
PageHeader: "Kanban" + description "N ordens ativas"
  → Colunas do kanban
```

Sem `SectionDivider` — o layout visual das colunas já organiza o conteúdo.

**Cabeçalho de coluna:** aplicar `.label-mono` no título de cada `KanbanColumn`:
```tsx
<div className="flex items-center gap-2 px-3 py-2">
  <span className="label-mono">{column.label}</span>
  <span className="label-mono text-foreground/30 ml-auto">{count}</span>
</div>
```

**KanbanCard:** usar `StatusBadge variant='dot'` no badge de status dentro do card.

---

## Fora de Escopo

- Lazy imports, dynamic imports, bundle optimization — tarefa separada
- Alterações em lógica de negócio, serializers, hooks de dados
- Novos campos ou endpoints de API
- Componentes fora de `card`, `page-header`, `status-badge`, `SectionDivider`
- Outras páginas além de `/dashboard`, `/service-orders`, `/service-orders/kanban`
- CSS resets globais ou mudanças em fontes

---

## Critério de Aceitação

1. `card.tsx`: fundo escuro alinhado com o dark theme (sem card branco em fundo preto)
2. Dashboard: metrics em grid com dividers verticais `divide-x divide-white/5`
3. OS List e Kanban: PageHeader sem repetição de título
4. Status badges com dot pulsante disponível como variante opt-in
5. SectionDivider funcional no dashboard (VISÃO GERAL + OS RECENTES)
6. `make lint` e `tsc --strict` passando sem erros novos
