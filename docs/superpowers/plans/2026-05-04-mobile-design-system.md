# Mobile Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar tokens semânticos mobile↔web e migrar todas as telas do app mobile para o design system fintech-red com expressão nativa (glass morphism mantido).

**Architecture:** Layer 1 (tokens + OS_STATUS_MAP), Layer 2 (5 componentes UI novos), Layer 3 (refactor OSStatusBadge + OSCard), Layer 4 (migração de 10 telas). Cada layer é um sprint independente e testável.

**Tech Stack:** React Native, Expo SDK 55, TypeScript strict, Animated API nativa

**Spec:** `docs/superpowers/specs/2026-05-04-mobile-design-system-design.md`

---

## File Structure

### Files to Create
- `apps/mobile/src/constants/theme.ts` — rewrite (token unification + OS_STATUS_MAP + Typography)
- `apps/mobile/src/components/ui/SectionDivider.tsx` — section header with mono label + line
- `apps/mobile/src/components/ui/StatusDot.tsx` — pulsating status indicator
- `apps/mobile/src/components/ui/SemanticBadge.tsx` — bg/border/text badge with 5 variants
- `apps/mobile/src/components/ui/MonoLabel.tsx` — monospace text for numbers/IDs
- `apps/mobile/src/components/ui/InfoRow.tsx` — key-value row for detail screens

### Files to Modify
- `apps/mobile/src/components/ui/Text.tsx` — add `mono` variant
- `apps/mobile/src/components/os/OSStatusBadge.tsx` — use OS_STATUS_MAP, add StatusDot
- `apps/mobile/src/components/os/OSCard.tsx` — use OS_STATUS_MAP, MonoLabel for OS#
- `apps/mobile/app/(app)/os/[id].tsx` — SectionDivider, InfoRow, StatusDot, SemanticBadge
- `apps/mobile/app/(app)/nova-os/index.tsx` — SemanticColors for offline banner
- `apps/mobile/app/(app)/checklist/index.tsx` — SemanticBadge
- `apps/mobile/app/(app)/checklist/[osId].tsx` — labelMono tab headers
- `apps/mobile/app/(app)/agenda/index.tsx` — StatusDot, OS_STATUS_MAP
- `apps/mobile/app/(app)/notificacoes/index.tsx` — SemanticBadge, StatusDot
- `apps/mobile/app/(app)/busca/index.tsx` — SemanticBadge, SectionDivider
- `apps/mobile/app/(app)/perfil/index.tsx` — InfoRow, SectionDivider
- `apps/mobile/app/(app)/os/index.tsx` — MonoLabel for count

### Files to Delete
- `apps/mobile/src/lib/theme.ts` — legacy, unused

---

## Sprint 1 — Token Unification

### Task 1: Expand `theme.ts` with semantic tokens

**Files:**
- Modify: `apps/mobile/src/constants/theme.ts`

- [ ] **Step 1: Add SemanticColors, Typography, OS_STATUS_MAP**

Add these exports AFTER the existing `Shadow` export at line 107:

```typescript
// ── Semantic Badge Colors ─────────────────────────────────────────────────
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

export type SemanticVariant = keyof typeof SemanticColors;

// ── Typography Presets ────────────────────────────────────────────────────
import { Platform } from 'react-native';

const MONO_FAMILY = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export const Typography = {
  labelMono: {
    fontSize: 10,
    fontFamily: MONO_FAMILY,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: '#cc4444',
  },
  mono: {
    fontFamily: MONO_FAMILY,
    letterSpacing: 0.5,
  },
  plate: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: 3,
  },
  osNumber: {
    fontSize: 14,
    fontFamily: MONO_FAMILY,
    fontWeight: '600' as const,
    color: '#cc4444',
  },
} as const;

// ── OS Status Map (Single Source of Truth) ────────────────────────────────
export const OS_STATUS_MAP = {
  reception:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',    label: 'Recepção',            semantic: 'info'    as SemanticVariant },
  initial_survey: { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)',   label: 'Vistoria Inicial',    semantic: 'info'    as SemanticVariant },
  budget:         { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',    label: 'Orçamento',           semantic: 'warning' as SemanticVariant },
  waiting_auth:   { color: '#fb923c', bg: 'rgba(251,146,60,0.15)',    label: 'Aguard. Autorização', semantic: 'warning' as SemanticVariant },
  authorized:     { color: '#34d399', bg: 'rgba(52,211,153,0.15)',    label: 'Autorizada',          semantic: 'success' as SemanticVariant },
  waiting_parts:  { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)',   label: 'Aguard. Peças',       semantic: 'neutral' as SemanticVariant },
  repair:         { color: '#22d3ee', bg: 'rgba(34,211,238,0.15)',    label: 'Reparo',              semantic: 'info'    as SemanticVariant },
  mechanic:       { color: '#38bdf8', bg: 'rgba(56,189,248,0.15)',    label: 'Mecânica',            semantic: 'info'    as SemanticVariant },
  bodywork:       { color: '#fb923c', bg: 'rgba(251,146,60,0.15)',    label: 'Funilaria',           semantic: 'warning' as SemanticVariant },
  painting:       { color: '#c084fc', bg: 'rgba(192,132,252,0.15)',   label: 'Pintura',             semantic: 'info'    as SemanticVariant },
  assembly:       { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',    label: 'Montagem',            semantic: 'warning' as SemanticVariant },
  polishing:      { color: '#22d3ee', bg: 'rgba(34,211,238,0.15)',    label: 'Polimento',           semantic: 'info'    as SemanticVariant },
  washing:        { color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',    label: 'Lavagem',             semantic: 'info'    as SemanticVariant },
  final_survey:   { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)',   label: 'Vistoria Final',      semantic: 'info'    as SemanticVariant },
  ready:          { color: '#4ade80', bg: 'rgba(74,222,128,0.15)',    label: 'Pronto p/ Entrega',   semantic: 'success' as SemanticVariant },
  delivered:      { color: 'rgba(255,255,255,0.92)', bg: 'rgba(255,255,255,0.08)', label: 'Entregue', semantic: 'neutral' as SemanticVariant },
  cancelled:      { color: '#f87171', bg: 'rgba(248,113,113,0.15)',   label: 'Cancelada',           semantic: 'error'   as SemanticVariant },
} as const;

export type OSStatus = keyof typeof OS_STATUS_MAP;
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to theme.ts

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/constants/theme.ts
git commit -m "feat(mobile): add SemanticColors, Typography, OS_STATUS_MAP to theme"
```

### Task 2: Delete legacy `lib/theme.ts`

**Files:**
- Delete: `apps/mobile/src/lib/theme.ts`

- [ ] **Step 1: Verify no imports of `lib/theme.ts` exist**

Run: `grep -r "lib/theme" apps/mobile/src/ apps/mobile/app/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: No results (file is unused)

- [ ] **Step 2: Delete the file**

```bash
rm apps/mobile/src/lib/theme.ts
```

- [ ] **Step 3: Verify typecheck still passes**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | head -10`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add -A apps/mobile/src/lib/theme.ts
git commit -m "chore(mobile): remove legacy lib/theme.ts — constants/theme.ts is single source"
```

### Task 3: Add `mono` variant to `Text.tsx`

**Files:**
- Modify: `apps/mobile/src/components/ui/Text.tsx`

- [ ] **Step 1: Add mono variant**

In `Text.tsx`, change the `TextVariant` type and add the style:

```typescript
// Line 1: add Platform import
import { Text as RNText, TextProps as RNTextProps, StyleSheet, Platform } from 'react-native';

// Line 5: update TextVariant union
type TextVariant = 'heading1' | 'heading2' | 'heading3' | 'body' | 'bodySmall' | 'caption' | 'label' | 'mono';

// Add after `label` style (line 65):
  mono: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
  },
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/Text.tsx
git commit -m "feat(mobile): add mono variant to Text component"
```

---

## Sprint 2 — New UI Components

### Task 4: Create `SectionDivider`

**Files:**
- Create: `apps/mobile/src/components/ui/SectionDivider.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { Typography } from '@/constants/theme';

interface SectionDividerProps {
  label: string;
  style?: ViewStyle;
}

export function SectionDivider({ label, style }: SectionDividerProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  label: {
    ...Typography.labelMono,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "SectionDivider" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/SectionDivider.tsx
git commit -m "feat(mobile): add SectionDivider component — label-mono + line"
```

### Task 5: Create `StatusDot`

**Files:**
- Create: `apps/mobile/src/components/ui/StatusDot.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { OS_STATUS_MAP, type OSStatus } from '@/constants/theme';

interface StatusDotProps {
  status: OSStatus;
  size?: number;
  pulse?: boolean;
}

export function StatusDot({ status, size = 8, pulse = false }: StatusDotProps): React.JSX.Element {
  const config = OS_STATUS_MAP[status];
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, opacity]);

  if (!config) return <View />;

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: config.color,
          opacity,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "StatusDot" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/StatusDot.tsx
git commit -m "feat(mobile): add StatusDot component — pulsating status indicator"
```

### Task 6: Create `SemanticBadge`

**Files:**
- Create: `apps/mobile/src/components/ui/SemanticBadge.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { SemanticColors, Radii, type SemanticVariant } from '@/constants/theme';

interface SemanticBadgeProps {
  variant: SemanticVariant;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function SemanticBadge({ variant, label, icon }: SemanticBadgeProps): React.JSX.Element {
  const colors = SemanticColors[variant];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
      ]}
    >
      {icon != null && (
        <Ionicons name={icon} size={12} color={colors.color} />
      )}
      <Text style={[styles.label, { color: colors.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "SemanticBadge" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/SemanticBadge.tsx
git commit -m "feat(mobile): add SemanticBadge component — 5 semantic variants"
```

### Task 7: Create `MonoLabel`

**Files:**
- Create: `apps/mobile/src/components/ui/MonoLabel.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { Text } from './Text';
import { Typography, Colors } from '@/constants/theme';

interface MonoLabelProps {
  children: string;
  variant?: 'default' | 'accent';
  size?: 'sm' | 'md';
  style?: TextStyle;
}

export function MonoLabel({
  children,
  variant = 'default',
  size = 'md',
  style,
}: MonoLabelProps): React.JSX.Element {
  return (
    <Text
      style={[
        styles.base,
        size === 'sm' && styles.sm,
        variant === 'accent' && styles.accent,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    ...Typography.mono,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sm: {
    fontSize: 12,
  },
  accent: {
    color: '#cc4444',
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "MonoLabel" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/MonoLabel.tsx
git commit -m "feat(mobile): add MonoLabel component — monospace text for numbers/IDs"
```

### Task 8: Create `InfoRow`

**Files:**
- Create: `apps/mobile/src/components/ui/InfoRow.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Typography, Colors, Spacing } from '@/constants/theme';

interface InfoRowProps {
  label: string;
  value: string | React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  noDivider?: boolean;
  style?: ViewStyle;
}

export function InfoRow({
  label,
  value,
  icon,
  noDivider = false,
  style,
}: InfoRowProps): React.JSX.Element {
  return (
    <View style={[styles.container, !noDivider && styles.divider, style]}>
      <View style={styles.labelRow}>
        {icon != null && (
          <Ionicons name={icon} size={14} color={Colors.textTertiary} style={styles.icon} />
        )}
        <Text style={styles.label}>{label}</Text>
      </View>
      {typeof value === 'string' ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  label: {
    ...Typography.labelMono,
    color: Colors.textTertiary,
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "InfoRow" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/InfoRow.tsx
git commit -m "feat(mobile): add InfoRow component — key-value row for detail screens"
```

---

## Sprint 3 — Refactor Existing Components

### Task 9: Refactor `OSStatusBadge` to use `OS_STATUS_MAP`

**Files:**
- Modify: `apps/mobile/src/components/os/OSStatusBadge.tsx`

- [ ] **Step 1: Rewrite to use OS_STATUS_MAP**

Replace the entire file with:

```typescript
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { OS_STATUS_MAP, Colors, type OSStatus } from '@/constants/theme';

interface OSStatusBadgeProps {
  status: string;
}

export function OSStatusBadge({ status }: OSStatusBadgeProps): React.JSX.Element {
  const config = OS_STATUS_MAP[status as OSStatus];
  if (!config) {
    return (
      <View style={[styles.badge, { backgroundColor: Colors.bg }]}>
        <Text variant="caption" style={[styles.label, { color: Colors.textPrimary }]}>
          Desconhecido
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text variant="caption" style={[styles.label, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );
}

/** Get the primary color for a status (used by filter chips). */
export function getStatusColor(status: string): string {
  return OS_STATUS_MAP[status as OSStatus]?.color ?? Colors.textPrimary;
}

/** Get the background color for a status (used by selected chips). */
export function getStatusBackgroundColor(status: string): string {
  return OS_STATUS_MAP[status as OSStatus]?.bg ?? Colors.bg;
}

/** Get the translated label for a status. */
export function getStatusLabel(status: string): string {
  return OS_STATUS_MAP[status as OSStatus]?.label ?? 'Desconhecido';
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "OSStatusBadge\|getStatus" | head -10`
Expected: No errors (all consumers use the same exported interface)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/os/OSStatusBadge.tsx
git commit -m "refactor(mobile): OSStatusBadge uses OS_STATUS_MAP — removes duplicated 17-entry map"
```

### Task 10: Refactor `OSCard` to use `OS_STATUS_MAP` + `MonoLabel`

**Files:**
- Modify: `apps/mobile/src/components/os/OSCard.tsx`

- [ ] **Step 1: Replace STATUS_BORDER_COLOR with OS_STATUS_MAP**

Remove lines 17-39 (the `STATUS_BORDER_COLOR` map and `getLeftBorderColor` function) and replace with:

```typescript
import { Colors, Radii, Shadow, Spacing, OS_STATUS_MAP, type OSStatus } from '@/constants/theme';
import { MonoLabel } from '@/components/ui/MonoLabel';
```

Replace `getLeftBorderColor` usage (line 50):
```typescript
const borderColor = OS_STATUS_MAP[order.status as OSStatus]?.color ?? '#94a3b8';
```

- [ ] **Step 2: Replace OS# text with MonoLabel**

Replace the OS number text (line 85-87):

```typescript
{/* Before */}
<Text variant="label" style={styles.osNumber}>
  OS #{order.number}
</Text>

{/* After */}
<MonoLabel variant="accent" size="sm">
  {`OS #${order.number}`}
</MonoLabel>
```

Remove the `osNumber` style from the StyleSheet (lines 177-180).

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "OSCard" | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/os/OSCard.tsx
git commit -m "refactor(mobile): OSCard uses OS_STATUS_MAP + MonoLabel — removes duplicated status map"
```

---

## Sprint 4 — Screen Migrations (Part 1: Core Screens)

### Task 11: Migrate Nova OS — offline banner hardcode

**Files:**
- Modify: `apps/mobile/app/(app)/nova-os/index.tsx`

- [ ] **Step 1: Replace hardcoded offline banner color**

Add import:
```typescript
import { Colors, Radii, Spacing, SemanticColors } from '@/constants/theme';
```

Replace in styles (line 199):
```typescript
// Before
backgroundColor: 'rgba(245,158,11,0.15)',

// After
backgroundColor: SemanticColors.warning.bg,
```

- [ ] **Step 2: Verify visual — start expo, open Nova OS, toggle airplane mode**

Run: `cd apps/mobile && npx expo start --clear`
Expected: Offline banner renders with same amber tint (SemanticColors.warning.bg = rgba(251,191,36,0.10) — slightly different shade but consistent with system)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(app)/nova-os/index.tsx
git commit -m "fix(mobile): nova-os offline banner uses SemanticColors.warning.bg — removes hardcode"
```

### Task 12: Migrate Busca — offline badge + section divider

**Files:**
- Modify: `apps/mobile/app/(app)/busca/index.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { Colors, Radii, Spacing, SemanticColors } from '@/constants/theme';
import { SemanticBadge } from '@/components/ui/SemanticBadge';
import { SectionDivider } from '@/components/ui/SectionDivider';
```

- [ ] **Step 2: Replace offline badge (lines 180-187)**

```typescript
// Before
const offlineBadge = isOffline ? (
  <View style={styles.offlineBadge}>
    <Text variant="caption" color="#92400e">
      Offline — resultados locais
    </Text>
  </View>
) : null;

// After
const offlineBadge = isOffline ? (
  <SemanticBadge
    variant="warning"
    label="Offline — resultados locais"
    icon="cloud-offline-outline"
  />
) : null;
```

Remove the `offlineBadge` style from StyleSheet.

- [ ] **Step 3: Add SectionDivider before "Buscas recentes" section**

Find the history title text and replace with `SectionDivider`:

```typescript
// Before
<Text variant="label" color={Colors.textSecondary}>Buscas recentes</Text>

// After
<SectionDivider label="RECENTES" />
```

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "busca" | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(app)/busca/index.tsx
git commit -m "fix(mobile): busca uses SemanticBadge + SectionDivider — removes hardcoded #fef3c7"
```

### Task 13: Migrate Notificações — auto badge + status dots

**Files:**
- Modify: `apps/mobile/app/(app)/notificacoes/index.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { SemanticColors } from '@/constants/theme';
import { SemanticBadge } from '@/components/ui/SemanticBadge';
import { StatusDot } from '@/components/ui/StatusDot';
import type { OSStatus } from '@/constants/theme';
```

- [ ] **Step 2: Replace auto badge (line ~279)**

Find the auto badge with `${Colors.warning}1a` background and replace:

```typescript
// Before — inline style with template string
backgroundColor: `${Colors.warning}1a`,

// After — semantic token
backgroundColor: SemanticColors.warning.bg,
```

- [ ] **Step 3: Add StatusDot to status transitions**

Where status from→to is shown, add `StatusDot` before each status label:

```typescript
<StatusDot status={item.from_status as OSStatus} size={6} />
```

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "notificacoes" | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(app)/notificacoes/index.tsx
git commit -m "fix(mobile): notificacoes uses SemanticColors + StatusDot — removes hex interpolation"
```

---

## Sprint 5 — Screen Migrations (Part 2: Detail Screens)

### Task 14: Migrate OS Detail — SectionDivider, InfoRow, SemanticBadge

**Files:**
- Modify: `apps/mobile/app/(app)/os/[id].tsx`

- [ ] **Step 1: Add imports**

```typescript
import { SectionDivider } from '@/components/ui/SectionDivider';
import { InfoRow } from '@/components/ui/InfoRow';
import { MonoLabel } from '@/components/ui/MonoLabel';
import { StatusDot } from '@/components/ui/StatusDot';
import { SemanticColors, OS_STATUS_MAP, type OSStatus } from '@/constants/theme';
```

- [ ] **Step 2: Add SectionDividers before each content block**

Add `<SectionDivider label="DADOS GERAIS" />` before the vehicle/customer info section.
Add `<SectionDivider label="PEÇAS E SERVIÇOS" />` before parts/labor lists.
Add `<SectionDivider label="FOTOS" />` before photos section.
Add `<SectionDivider label="HISTÓRICO" />` before transition logs.

- [ ] **Step 3: Replace hardcoded vistoria CTA tints (lines ~405-406)**

```typescript
// Before
const bg = isEntrada ? 'rgba(59, 130, 246, 0.10)' : 'rgba(22, 163, 74, 0.10)';
const borderColor = isEntrada ? 'rgba(59, 130, 246, 0.28)' : 'rgba(22, 163, 74, 0.28)';

// After
const semantic = isEntrada ? SemanticColors.info : SemanticColors.success;
const bg = semantic.bg;
const borderColor = semantic.border;
```

- [ ] **Step 4: Use MonoLabel for totals**

Where parts_total and services_total are displayed, replace inline text:

```typescript
// Before
<Text variant="label" color={Colors.textPrimary}>R$ {order.parts_total}</Text>

// After
<MonoLabel variant="accent">{`R$ ${order.parts_total}`}</MonoLabel>
```

- [ ] **Step 5: Add StatusDot to header**

Next to the existing status badge in the header, add a pulsating dot for active statuses:

```typescript
const isActiveStatus = order.status !== 'delivered' && order.status !== 'cancelled';
// ...
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
  <StatusDot status={order.status as OSStatus} pulse={isActiveStatus} />
  {/* existing status badge */}
</View>
```

- [ ] **Step 6: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "\[id\]" | head -10`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/(app)/os/[id].tsx
git commit -m "feat(mobile): OS detail uses SectionDivider, InfoRow, MonoLabel, StatusDot, SemanticColors"
```

### Task 15: Migrate Perfil — InfoRow + SectionDivider

**Files:**
- Modify: `apps/mobile/app/(app)/perfil/index.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { InfoRow } from '@/components/ui/InfoRow';
import { SectionDivider } from '@/components/ui/SectionDivider';
```

- [ ] **Step 2: Replace info rows with InfoRow component**

Replace each manual `<View style={styles.infoRow}>` block:

```typescript
// Before
<View style={styles.infoRow}>
  <Text variant="caption" color={Colors.textSecondary}>Nome</Text>
  <Text variant="body">{user.name}</Text>
</View>

// After
<InfoRow label="NOME" value={user.name} icon="person-outline" />
```

Apply the same pattern for email, empresa, role.

- [ ] **Step 3: Add SectionDivider**

```typescript
<SectionDivider label="DADOS PESSOAIS" />
```

Before the info rows block.

- [ ] **Step 4: Remove old infoRow styles from StyleSheet**

- [ ] **Step 5: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "perfil" | head -10`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/(app)/perfil/index.tsx
git commit -m "feat(mobile): perfil uses InfoRow + SectionDivider"
```

---

## Sprint 6 — Screen Migrations (Part 3: Secondary Screens)

### Task 16: Migrate Checklist — tab headers + SemanticBadge

**Files:**
- Modify: `apps/mobile/app/(app)/checklist/[osId].tsx`
- Modify: `apps/mobile/app/(app)/checklist/index.tsx`

- [ ] **Step 1: Apply labelMono style to tab headers in `[osId].tsx`**

Add import:
```typescript
import { Typography } from '@/constants/theme';
```

Update the active tab label style to include labelMono characteristics:
```typescript
// In styles, update the active tab text
tabTextActive: {
  ...Typography.labelMono,
  color: Colors.brand,
  fontSize: 12, // slightly larger than default labelMono 10px for readability
},
```

- [ ] **Step 2: In `checklist/index.tsx`, use MonoLabel for photo count**

Add import:
```typescript
import { MonoLabel } from '@/components/ui/MonoLabel';
```

Replace photo count badge text:
```typescript
// Before
<Text variant="caption" ...>{count}</Text>

// After
<MonoLabel size="sm">{String(count)}</MonoLabel>
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "checklist" | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/checklist/
git commit -m "feat(mobile): checklist uses labelMono tabs + MonoLabel counts"
```

### Task 17: Migrate Agenda — StatusDot + OS_STATUS_MAP

**Files:**
- Modify: `apps/mobile/app/(app)/agenda/index.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { OS_STATUS_MAP, type OSStatus } from '@/constants/theme';
import { StatusDot } from '@/components/ui/StatusDot';
```

- [ ] **Step 2: Replace legend dots with StatusDot**

Where hardcoded dots are rendered for legend (entrada/entrega), replace with StatusDot:

```typescript
// Before — manual View with backgroundColor
<View style={[styles.legendDot, { backgroundColor: Colors.info }]} />

// After
<StatusDot status={'reception' as OSStatus} size={8} />
```

- [ ] **Step 3: Replace event card left bar color**

Where event cards compute color from status, use `OS_STATUS_MAP`:

```typescript
// Before — inline color or template string
const eventColor = getColorForStatus(event.status);

// After
const eventColor = OS_STATUS_MAP[event.status as OSStatus]?.color ?? Colors.textSecondary;
```

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "agenda" | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(app)/agenda/index.tsx
git commit -m "feat(mobile): agenda uses StatusDot + OS_STATUS_MAP"
```

### Task 18: Migrate Vistoria — SectionDivider + SemanticBadge

**Files:**
- Modify: `apps/mobile/app/(app)/vistoria/entrada/[osId].tsx`
- Modify: `apps/mobile/app/(app)/vistoria/saida/[osId].tsx`

- [ ] **Step 1: Add imports to both files**

```typescript
import { SectionDivider } from '@/components/ui/SectionDivider';
import { SemanticBadge } from '@/components/ui/SemanticBadge';
```

- [ ] **Step 2: Add SectionDividers in entrada**

Before each major section:
```typescript
<SectionDivider label="FOTOS" />
{/* PhotoSlotGrid */}

<SectionDivider label="ITENS DO CHECKLIST" />
{/* ItemChecklistGrid */}

<SectionDivider label="OBSERVAÇÕES" />
{/* TextInput */}
```

- [ ] **Step 3: Apply same pattern in saida**

Same SectionDividers + replace any summary badges with SemanticBadge if applicable.

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "vistoria" | head -10`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(app)/vistoria/
git commit -m "feat(mobile): vistoria uses SectionDivider + SemanticBadge"
```

### Task 19: Migrate OS List — MonoLabel for count

**Files:**
- Modify: `apps/mobile/app/(app)/os/index.tsx`

- [ ] **Step 1: Add import**

```typescript
import { MonoLabel } from '@/components/ui/MonoLabel';
```

- [ ] **Step 2: Replace OS count text in header with MonoLabel**

Find the OS count display and replace:

```typescript
// Before
<Text variant="heading3" ...>{orders.length} OS</Text>

// After
<MonoLabel variant="accent" size="md">{`${orders.length} OS`}</MonoLabel>
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -i "os/index" | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(app)/os/index.tsx
git commit -m "feat(mobile): OS list uses MonoLabel for count"
```

---

## Sprint 7 — Final Verification

### Task 20: Full typecheck + visual smoke test

**Files:** All modified files

- [ ] **Step 1: Run full typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Verify no remaining hardcoded colors**

Run: `grep -rn "#fef3c7\|#92400e\|rgba(245,158,11" apps/mobile/app/ apps/mobile/src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v theme.ts`
Expected: No results (all hardcodes eliminated)

- [ ] **Step 3: Verify no imports of deleted lib/theme.ts**

Run: `grep -rn "lib/theme" apps/mobile/ --include="*.tsx" --include="*.ts" | grep -v node_modules`
Expected: No results

- [ ] **Step 4: Verify OS_STATUS_MAP is the only status color source**

Run: `grep -rn "STATUS_BORDER_COLOR\|STATUS_CONFIG" apps/mobile/src/ apps/mobile/app/ --include="*.tsx" --include="*.ts"`
Expected: No results (both old maps removed)

- [ ] **Step 5: Start expo and smoke test**

Run: `cd apps/mobile && npx expo start --clear`
Check each screen:
- OS List: MonoLabel for count
- OS Detail: SectionDividers, InfoRow, StatusDot pulse, MonoLabel totals
- Nova OS: SemanticColors warning banner
- Checklist: labelMono tabs
- Busca: SemanticBadge offline, SectionDivider recentes
- Notificações: SemanticBadge auto, StatusDot transitions
- Perfil: InfoRow + SectionDivider
- Agenda: StatusDot legend, OS_STATUS_MAP colors

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore(mobile): design system migration complete — 10 screens, 5 components, 0 hardcodes"
```
