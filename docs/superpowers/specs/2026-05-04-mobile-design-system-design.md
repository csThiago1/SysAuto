# Mobile Design System — Shared Language, Native Expression

**Data:** 2026-05-04
**Abordagem:** Unificar linguagem semântica (tokens, tipografia, status) com o web, mantendo expressão nativa mobile (glass morphism, gradients, haptics)

---

## 1. Problema

O mobile tem uma estética dark glass funcional (OSCard, FrostedNavBar, wizard), mas diverge do design system fintech-red do web em:

- **Dois arquivos de tema** — `constants/theme.ts` (usado) e `lib/theme.ts` (legado, não usado)
- **Cores hardcoded** em 3+ telas (nova-os offline banner, busca offline badge, notificações auto-badge)
- **Status colors duplicados** — maps separados em `OSCard.tsx` e `OSStatusBadge.tsx` com 17 entradas cada
- **Sem componentes de linguagem visual** — o web tem `label-mono`, `section-divider`, `StatusPill` com pulse dot, badges `bg-{color}/10`; o mobile não tem equivalentes
- **Padrões ad-hoc** — cada tela reinventa info rows, section headers, badges de status

---

## 2. Escopo

### Incluso
- Reescrita de `constants/theme.ts` com tokens semânticos
- Deleção de `lib/theme.ts`
- 5 novos componentes UI compartilhados
- Refactor de 2 componentes existentes (OSStatusBadge, OSCard)
- Migração de ~10 telas para tokens + componentes novos
- Adição de variant `mono` no componente `Text`

### Excluído
- Photo Editor e Camera (telas funcionais, não de conteúdo)
- Reescrita de componentes que já funcionam bem (Card, FrostedNavBar, OSDetailHeader)
- Mudanças na arquitetura de navegação

---

## 3. Layer 1 — Token Unification

### 3.1 Arquivo único: `src/constants/theme.ts`

Deletar `src/lib/theme.ts` (legado, nenhum import ativo).

Expandir `src/constants/theme.ts` com:

```typescript
// ── Semantic Colors ──────────────────────────────────────────────
export const SemanticColors = {
  success: {
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.10)',
    border: 'rgba(74,222,128,0.20)',
  },
  error: {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.10)',
    border: 'rgba(248,113,113,0.20)',
  },
  warning: {
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.10)',
    border: 'rgba(251,191,36,0.20)',
  },
  info: {
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.10)',
    border: 'rgba(96,165,250,0.20)',
  },
  neutral: {
    color: 'rgba(255,255,255,0.55)',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.10)',
  },
} as const;
```

Adicionar ao `Colors` existente:

```typescript
// Novos tokens no Colors
text: {
  primary: 'rgba(255,255,255,0.92)',   // já existe como textPrimary
  secondary: 'rgba(255,255,255,0.55)', // já existe como textSecondary
  tertiary: 'rgba(255,255,255,0.35)',  // já existe como textTertiary
  mono: '#cc4444',                      // NOVO — label-mono do web
},
brandTint: 'rgba(227,27,27,0.10)',      // NOVO — fundo sutil brand
semantic: SemanticColors,                // NOVO — referência direta
```

### 3.2 Typography tokens

```typescript
export const Typography = {
  labelMono: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: '#cc4444',
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  plate: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
  },
  osNumber: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600' as const,
    color: '#cc4444',
  },
} as const;
```

### 3.3 OS_STATUS_MAP — Single Source of Truth

Substituir os maps duplicados em `OSCard.tsx` e `OSStatusBadge.tsx`:

```typescript
export const OS_STATUS_MAP = {
  reception:       { color: '#60a5fa', label: 'Recepção',       phase: 'intake',    semantic: 'info' },
  initial_survey:  { color: '#a78bfa', label: 'Vistoria',       phase: 'intake',    semantic: 'info' },
  budget:          { color: '#fbbf24', label: 'Orçamento',      phase: 'approval',  semantic: 'warning' },
  waiting_auth:    { color: '#fb923c', label: 'Aguard. Autoriz.', phase: 'approval', semantic: 'warning' },
  authorized:      { color: '#34d399', label: 'Autorizada',     phase: 'execution', semantic: 'success' },
  waiting_parts:   { color: '#94a3b8', label: 'Aguard. Peças',  phase: 'execution', semantic: 'neutral' },
  repair:          { color: '#22d3ee', label: 'Reparação',      phase: 'execution', semantic: 'info' },
  mechanic:        { color: '#38bdf8', label: 'Mecânica',       phase: 'execution', semantic: 'info' },
  bodywork:        { color: '#fb923c', label: 'Funilaria',      phase: 'execution', semantic: 'warning' },
  painting:        { color: '#c084fc', label: 'Pintura',        phase: 'execution', semantic: 'info' },
  assembly:        { color: '#fbbf24', label: 'Montagem',       phase: 'execution', semantic: 'warning' },
  polishing:       { color: '#22d3ee', label: 'Polimento',      phase: 'finishing', semantic: 'info' },
  washing:         { color: '#22d3ee', label: 'Lavagem',        phase: 'finishing', semantic: 'info' },
  final_survey:    { color: '#a78bfa', label: 'Vist. Saída',    phase: 'finishing', semantic: 'info' },
  ready:           { color: '#4ade80', label: 'Pronto',         phase: 'delivery',  semantic: 'success' },
  delivered:       { color: 'rgba(255,255,255,0.92)', label: 'Entregue', phase: 'delivery', semantic: 'neutral' },
  cancelled:       { color: '#f87171', label: 'Cancelada',      phase: 'closed',    semantic: 'error' },
} as const;

export type OSStatus = keyof typeof OS_STATUS_MAP;
```

Cada status expõe: `color` (cor primária para border/dot), `label` (PT-BR), `phase` (agrupamento lógico), `semantic` (qual SemanticColor usar para badges/backgrounds).

---

## 4. Layer 2 — Novos Componentes

### 4.1 `SectionDivider`

Arquivo: `src/components/ui/SectionDivider.tsx`

Equivalente mobile do `.section-divider` do web. Renderiza:
```
  PEÇAS E SERVIÇOS ─────────────────
```

- Label usa `Typography.labelMono` (10px, monospace, uppercase, #cc4444)
- Linha horizontal `rgba(255,255,255,0.06)`, height 1px (StyleSheet.hairlineWidth)
- Layout: `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 8`
- Props: `label: string`, `style?: ViewStyle`

### 4.2 `StatusDot`

Arquivo: `src/components/ui/StatusDot.tsx`

Dot pulsante para indicar status ativo.

- Bolinha redonda, tamanho padrão 8px
- Cor extraída de `OS_STATUS_MAP[status].color`
- Quando `pulse={true}`: `Animated.loop` com opacity 1→0.4→1 em 4 segundos (equivalente ao `pulse-slow` do web CSS)
- Usa `useRef` + `Animated.timing` nativo (sem Reanimated — componente simples)
- Props: `status: OSStatus`, `size?: number`, `pulse?: boolean`

### 4.3 `SemanticBadge`

Arquivo: `src/components/ui/SemanticBadge.tsx`

Badge consistente com padrão `bg-{color}/10 + border-{color}/20 + text-{color}` do web.

- 5 variantes: `success`, `error`, `warning`, `info`, `neutral`
- Estilo: `borderRadius: Radii.full`, `borderWidth: 1`, `paddingHorizontal: 10`, `paddingVertical: 4`
- Cores: `SemanticColors[variant].bg` / `.border` / `.color`
- Texto: `fontSize: 11`, `fontWeight: '600'`, `textTransform: 'uppercase'`
- Ícone opcional à esquerda (Ionicons, 12px)
- Props: `variant: 'success' | 'error' | 'warning' | 'info' | 'neutral'`, `label: string`, `icon?: string`

### 4.4 `MonoLabel`

Arquivo: `src/components/ui/MonoLabel.tsx`

Texto monospace para valores numéricos, IDs, totais.

- Variante `default`: `Typography.mono` + `Colors.text.secondary`
- Variante `accent`: `Typography.mono` + `Colors.text.mono` (#cc4444) — para OS numbers, totais em R$
- Tamanhos: `sm` (12px), `md` (14px)
- Props: `children: string`, `variant?: 'default' | 'accent'`, `size?: 'sm' | 'md'`

### 4.5 `InfoRow`

Arquivo: `src/components/ui/InfoRow.tsx`

Linha key-value para telas de detalhe.

- Layout: `flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`
- Label: `Typography.labelMono` style (10px, monospace, uppercase), cor `Colors.text.tertiary`
- Valor: `fontSize: 14`, `color: Colors.text.primary`
- Divider inferior: `borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: rgba(255,255,255,0.04)`
- Padding vertical: `Spacing.md` (12px)
- Ícone opcional à esquerda do label (Ionicons, 14px, `Colors.text.tertiary`)
- Props: `label: string`, `value: string | ReactNode`, `icon?: string`, `noDivider?: boolean`

### 4.6 Ajuste em `Text.tsx`

Adicionar variant `mono`:
```typescript
mono: {
  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  fontSize: 14,
  letterSpacing: 0.5,
  color: Colors.text.secondary,
}
```

---

## 5. Layer 3 — Refactor de Componentes Existentes

### 5.1 `OSStatusBadge.tsx`

- Remover `STATUS_CONFIG` local (17 entries)
- Importar `OS_STATUS_MAP` de `constants/theme`
- Usar `OS_STATUS_MAP[status].color` para backgroundColor com opacity 15%
- Adicionar `StatusDot` inline à esquerda do label quando `showDot={true}`
- Manter interface pública inalterada (breaking change zero)

### 5.2 `OSCard.tsx`

- Remover `STATUS_BORDER_COLORS` local (17 entries)
- Importar `OS_STATUS_MAP` de `constants/theme`
- `leftBorderColor = OS_STATUS_MAP[status]?.color ?? Colors.border`
- Totais de peças/serviços: usar `MonoLabel variant="accent"` para valores R$
- Manter glass gradient, glint line, shadow — sem mudança visual no card

---

## 6. Layer 4 — Migração Tela-a-Tela

### 6.1 OS List (`app/(app)/os/index.tsx`)
- Header OS count: `MonoLabel variant="accent"`
- Filter badges no modal: `SemanticBadge` em vez de badges inline
- Sem mudança estrutural

### 6.2 OS Detail (`app/(app)/os/[id].tsx`)
- `SectionDivider` antes de cada bloco: "DADOS GERAIS", "PEÇAS E SERVIÇOS", "HISTÓRICO", "FOTOS"
- Info rows (placa, cliente, seguradora, datas): migrar para `InfoRow`
- Totais peças/serviços: `MonoLabel variant="accent"`
- Status no header: `StatusDot pulse={isActiveStatus}` ao lado do badge existente
- Vistoria CTAs: tints → `SemanticColors.info.bg` / `SemanticColors.success.bg`
- Upload status badges: `SemanticBadge` (variant por estado: done→success, error→error, pending→neutral)

### 6.3 Nova OS Wizard (`app/(app)/nova-os/index.tsx`)
- Offline banner: `rgba(245,158,11,0.15)` → `SemanticColors.warning.bg`
- Step labels: `MonoLabel` para "STEP 1", "STEP 2", etc.
- Section headers dentro dos steps: `SectionDivider`

### 6.4 Checklist (`checklist/[osId].tsx` + `checklist/index.tsx`)
- Tab headers: aplicar `Typography.labelMono` style
- Photo count: `MonoLabel`
- Status badges nos cards de checklist: `SemanticBadge`

### 6.5 Vistoria (`vistoria/entrada/` + `vistoria/saida/`)
- Section headers: `SectionDivider` ("FOTOS", "ITENS DO CHECKLIST", "OBSERVAÇÕES")
- Summary bar badges: `SemanticBadge`

### 6.6 Agenda (`agenda/index.tsx`)
- Legend dots: `StatusDot` (sem pulse)
- Event card left bar: cor via `OS_STATUS_MAP`
- Section headers por dia: `SectionDivider` com data formatada

### 6.7 Notificações (`notificacoes/index.tsx`)
- Auto badge: `${Colors.warning}1a` → `SemanticBadge variant="warning"`
- Status transition from→to: `StatusDot` + seta

### 6.8 Busca (`busca/index.tsx`)
- Offline badge: `#fef3c7` → `SemanticBadge variant="warning"`
- Section "RECENTES": `SectionDivider label="RECENTES"`

### 6.9 Perfil (`perfil/index.tsx`)
- Info rows (nome, email, empresa, role): migrar para `InfoRow`
- Section headers: `SectionDivider`

### 6.10 Photo Editor + Camera
- Sem mudanças — telas funcionais.

---

## 7. Resumo de Impacto

| Métrica | Valor |
|---------|-------|
| Componentes novos | 5 (`SectionDivider`, `StatusDot`, `SemanticBadge`, `MonoLabel`, `InfoRow`) |
| Componentes refatorados | 2 (`OSStatusBadge`, `OSCard`) + 1 variant (`Text`) |
| Telas migradas | 10 |
| Telas reescritas | 0 |
| Arquivos deletados | 1 (`lib/theme.ts`) |
| Hardcodes eliminados | 3+ |
| Maps duplicados eliminados | 2 (17 entries cada → 1 `OS_STATUS_MAP`) |

---

## 8. Padrões Estabelecidos

- **DS-M1:** `constants/theme.ts` é o ÚNICO arquivo de tema mobile. Nunca criar outro.
- **DS-M2:** Status colors vêm de `OS_STATUS_MAP` — nunca hardcodar cores de status em componentes.
- **DS-M3:** Badges de status usam `SemanticBadge` — nunca criar badges inline com cores hardcoded.
- **DS-M4:** Section headers usam `SectionDivider` — nunca `<Text>` solto com estilo manual.
- **DS-M5:** Valores monetários e IDs usam `MonoLabel` — nunca `<Text>` com fontFamily inline.
- **DS-M6:** Glass morphism (LinearGradient + glint) mantido em cards — nunca substituir por fundo sólido.
- **DS-M7:** `SemanticColors` para backgrounds com opacity — nunca `rgba()` hardcoded para status.
