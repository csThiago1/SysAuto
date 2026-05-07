# Mobile UX Primitives + Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 3 missing UI primitives (Toast, ConfirmDialog, StepIndicator) and integrate them across all mobile screens to provide user feedback on actions, prevent data loss, and show form progress.

**Architecture:** Build 3 self-contained components following the existing glass-morphism dark theme. Toast uses a Zustand store for imperative `toast.success()` calls (same pattern as sonner on web). ConfirmDialog is a controlled modal. StepIndicator is a pure presentational component. After building primitives, integrate into 7 screens.

**Tech Stack:** React Native, Expo SDK 52, react-native-reanimated 4.2, expo-haptics, Zustand, design tokens from `@/constants/theme`

---

## Conventions

- **Imports:** Always `import { Colors, SemanticColors, Typography, Spacing, Radii } from '@/constants/theme'`
- **Styling:** StyleSheet.create, NEVER inline hex values — always theme tokens
- **Haptics:** `expo-haptics` ImpactFeedbackStyle.Light for success, NotificationFeedbackType.Error for errors
- **Animations:** `react-native-reanimated` useSharedValue + useAnimatedStyle + withTiming/withSpring
- **Components:** Follow existing pattern: props interface → function component → StyleSheet.create

---

## File Map

### Primitives (3 new files)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/mobile/src/stores/toast.store.ts` | Zustand store for toast queue |
| Create | `apps/mobile/src/components/ui/Toast.tsx` | Toast renderer (mounts in root layout) |
| Create | `apps/mobile/src/components/ui/ConfirmDialog.tsx` | Modal dialog for destructive actions |
| Create | `apps/mobile/src/components/ui/StepIndicator.tsx` | Step progress (Passo 1 de 4) |

### Integration (8 files modified)

| Action | File | What changes |
|--------|------|-------------|
| Modify | `apps/mobile/app/_layout.tsx` | Mount `<Toast />` globally |
| Modify | `apps/mobile/app/(app)/os/[id].tsx` | Toast on status transition success/error |
| Modify | `apps/mobile/app/(app)/nova-os/index.tsx` | StepIndicator + Toast on create + ConfirmDialog on back |
| Modify | `apps/mobile/app/(app)/perfil/index.tsx` | ConfirmDialog on logout |
| Modify | `apps/mobile/app/(app)/vistoria/entrada/[osId].tsx` | ConfirmDialog before concluir + Toast |
| Modify | `apps/mobile/app/(app)/vistoria/saida/[osId].tsx` | ConfirmDialog before concluir + Toast |
| Modify | `apps/mobile/app/(app)/notificacoes/index.tsx` | Toast placeholder (future) |
| Modify | `apps/mobile/src/components/ui/index.ts` | Re-export new components (if barrel exists) |

---

## Workstream 1 — Primitives

---

### Task 1: Toast store (Zustand)

**Files:**
- Create: `apps/mobile/src/stores/toast.store.ts`

- [ ] **Step 1: Create the toast store**

```typescript
import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

interface ToastState {
  items: ToastItem[]
  add: (message: string, variant: ToastVariant, duration?: number) => void
  remove: (id: string) => void
}

let _id = 0

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  add: (message, variant, duration = 3000) => {
    const id = String(++_id)
    set((s) => ({ items: [...s.items, { id, message, variant, duration }] }))
  },
  remove: (id) => {
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }))
  },
}))

/** Imperative API — use anywhere without hooks */
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().add(message, 'success', duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().add(message, 'error', duration),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().add(message, 'warning', duration),
  info: (message: string, duration?: number) =>
    useToastStore.getState().add(message, 'info', duration),
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/stores/toast.store.ts
git commit -m "feat(mobile): add toast Zustand store with imperative API"
```

---

### Task 2: Toast UI component

**Files:**
- Create: `apps/mobile/src/components/ui/Toast.tsx`

- [ ] **Step 1: Create the Toast renderer**

```tsx
import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Text } from './Text'
import { Colors, SemanticColors, Radii, Spacing } from '@/constants/theme'
import { useToastStore, type ToastItem, type ToastVariant } from '@/stores/toast.store'

const ICON_MAP: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
}

function ToastCard({ item }: { item: ToastItem }) {
  const remove = useToastStore((s) => s.remove)
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(-20)

  useEffect(() => {
    // Haptic on mount
    if (item.variant === 'error') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } else if (item.variant === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }

    // Animate in
    opacity.value = withTiming(1, { duration: 200 })
    translateY.value = withTiming(0, { duration: 200 })

    // Animate out after duration
    opacity.value = withDelay(
      item.duration,
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished) runOnJS(remove)(item.id)
      })
    )
    translateY.value = withDelay(
      item.duration,
      withTiming(-20, { duration: 300 })
    )
  }, [item.id, item.duration, item.variant, opacity, translateY, remove])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const semantic = SemanticColors[item.variant === 'warning' ? 'warning' : item.variant]

  return (
    <Animated.View style={[styles.card, { backgroundColor: semantic.bg, borderColor: semantic.border }, animatedStyle]}>
      <Ionicons name={ICON_MAP[item.variant]} size={18} color={semantic.color} />
      <Text variant="bodySmall" style={{ color: semantic.color, flex: 1 }}>
        {item.message}
      </Text>
    </Animated.View>
  )
}

export function Toast() {
  const items = useToastStore((s) => s.items)
  const insets = useSafeAreaInsets()

  if (items.length === 0) return null

  return (
    <View style={[styles.container, { top: insets.top + Spacing.sm }]} pointerEvents="none">
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
})
```

- [ ] **Step 2: Mount Toast in root layout**

Edit `apps/mobile/app/_layout.tsx`. Add import and render `<Toast />` as the LAST child inside the outermost `<View>` or after `<Slot />`, so it floats above everything:

```tsx
import { Toast } from '@/components/ui/Toast'

// Inside the render, after <Slot /> or at the end of the provider tree:
<Toast />
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ui/Toast.tsx apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add Toast component with animated entrance and haptic feedback"
```

---

### Task 3: ConfirmDialog component

**Files:**
- Create: `apps/mobile/src/components/ui/ConfirmDialog.tsx`

- [ ] **Step 1: Create the ConfirmDialog**

```tsx
import React from 'react'
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Text } from './Text'
import { Button } from './Button'
import { Colors, Spacing, Radii, SemanticColors } from '@/constants/theme'

interface ConfirmDialogProps {
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Fechar diálogo"
      >
        <View
          style={styles.card}
          onStartShouldSetResponder={() => true}
          accessibilityRole="alert"
        >
          <Text variant="heading3" style={styles.title}>{title}</Text>
          <Text variant="body" style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text variant="body" style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>

            <Button
              label={confirmLabel}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              loading={loading}
              onPress={onConfirm}
              style={styles.confirmButton}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  message: {
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cancelButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  cancelText: {
    color: Colors.textSecondary,
  },
  confirmButton: {
    minWidth: 120,
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/ui/ConfirmDialog.tsx
git commit -m "feat(mobile): add ConfirmDialog with danger/default variants"
```

---

### Task 4: StepIndicator component

**Files:**
- Create: `apps/mobile/src/components/ui/StepIndicator.tsx`

- [ ] **Step 1: Create the StepIndicator**

```tsx
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { Colors, Spacing, Radii, Typography } from '@/constants/theme'

interface StepIndicatorProps {
  current: number
  total: number
  labels?: string[]
}

export function StepIndicator({ current, total, labels }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {/* Step dots with connecting lines */}
      <View style={styles.dotsRow}>
        {Array.from({ length: total }).map((_, i) => {
          const isCompleted = i < current
          const isActive = i === current
          const isLast = i === total - 1

          return (
            <React.Fragment key={i}>
              <View
                style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isActive && styles.dotActive,
                ]}
              >
                {isCompleted && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
                {isActive && (
                  <Text style={styles.dotNumber}>{i + 1}</Text>
                )}
                {!isCompleted && !isActive && (
                  <Text style={styles.dotNumber}>{i + 1}</Text>
                )}
              </View>
              {!isLast && (
                <View style={[styles.line, isCompleted && styles.lineCompleted]} />
              )}
            </React.Fragment>
          )
        })}
      </View>

      {/* Label */}
      <Text style={styles.label}>
        {labels?.[current] ?? `Passo ${current + 1} de ${total}`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: Colors.brand,
    borderColor: Colors.brand,
  },
  dotActive: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  dotNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  line: {
    width: 24,
    height: 2,
    backgroundColor: Colors.border,
  },
  lineCompleted: {
    backgroundColor: Colors.brand,
  },
  label: {
    ...Typography.labelMono,
    color: Colors.textSecondary,
    fontSize: 11,
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/ui/StepIndicator.tsx
git commit -m "feat(mobile): add StepIndicator with dots, lines, and step label"
```

---

## Workstream 2 — Integration

---

### Task 5: OS Detail — toast on status transition

**Files:**
- Modify: `apps/mobile/app/(app)/os/[id].tsx`

The OS detail screen has a `StatusUpdateModal` component (around line 157) that calls `updateStatus(nextStatus)`. On success it just closes the modal. We need to add toast feedback.

- [ ] **Step 1: Read the full file**

Read `apps/mobile/app/(app)/os/[id].tsx` entirely. Locate:
1. The `StatusUpdateModal` component and its `handleSelect` function
2. The `useUpdateOSStatus` hook call and its onSuccess/onError callbacks
3. Any other status-related actions (the "Avançar Status" button)

- [ ] **Step 2: Add toast import**

```tsx
import { toast } from '@/stores/toast.store'
```

- [ ] **Step 3: Add toast calls to status transition**

Find where `updateStatus` is called (inside StatusUpdateModal's handleSelect or in the hook's callbacks). Add:

```tsx
// On success (after status update completes):
toast.success(`Status atualizado para "${statusLabel}"`)

// On error (in catch block or onError):
toast.error('Erro ao atualizar status. Tente novamente.')
```

Also add toast for photo upload success in the AcompanhamentoSection if there's an upload success handler:
```tsx
// After successful photo upload:
toast.success('Foto enviada com sucesso')
```

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/os/[id].tsx"
git commit -m "feat(mobile): add toast feedback on OS status transition and photo upload"
```

---

### Task 6: Nova OS — StepIndicator + toast + back confirmation

**Files:**
- Modify: `apps/mobile/app/(app)/nova-os/index.tsx`

- [ ] **Step 1: Read the full file**

Read `apps/mobile/app/(app)/nova-os/index.tsx` entirely. Locate:
1. The progress bar rendering (around line 24-35, `ProgressBar` component)
2. The step names array (STEP_NAMES or equivalent)
3. The back button handler
4. The `handleConfirm` function that creates the OS (around line 50-86)

- [ ] **Step 2: Add imports**

```tsx
import { StepIndicator } from '@/components/ui/StepIndicator'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/stores/toast.store'
```

- [ ] **Step 3: Replace ProgressBar with StepIndicator**

Find the existing ProgressBar component rendering and replace with:

```tsx
<StepIndicator
  current={step}
  total={4}
  labels={['Veículo', 'Cliente', 'Tipo da OS', 'Revisão']}
/>
```

Remove the old ProgressBar component definition if it was inline (lines ~24-35). If it was a separate import, just stop rendering it.

- [ ] **Step 4: Add back confirmation dialog**

Add state:
```tsx
const [showBackConfirm, setShowBackConfirm] = useState(false)
```

Modify the back button handler. Find the existing `onPress` for the back button:
```tsx
// BEFORE — goes back directly:
onPress={() => { if (step > 0) setStep(step - 1) else router.back() }}

// AFTER — confirm if step > 0:
onPress={() => {
  if (step > 0) {
    setStep(step - 1)
  } else {
    setShowBackConfirm(true)
  }
}}
```

Add the dialog at the bottom of JSX:
```tsx
<ConfirmDialog
  visible={showBackConfirm}
  title="Descartar OS?"
  message="Os dados preenchidos serão perdidos. Deseja sair?"
  confirmLabel="Sair"
  cancelLabel="Continuar"
  variant="danger"
  onConfirm={() => {
    setShowBackConfirm(false)
    // Reset store if there's a reset function
    router.back()
  }}
  onCancel={() => setShowBackConfirm(false)}
/>
```

- [ ] **Step 5: Add toast on OS creation**

Find `handleConfirm` (around line 50-86). Add after successful creation:
```tsx
toast.success(`OS #${result.number} criada com sucesso!`)
```

Add in catch block:
```tsx
toast.error('Erro ao criar OS. Tente novamente.')
```

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(app)/nova-os/index.tsx"
git commit -m "feat(mobile): add StepIndicator, back confirmation, and toast to Nova OS form"
```

---

### Task 7: Profile — logout confirmation

**Files:**
- Modify: `apps/mobile/app/(app)/perfil/index.tsx`

- [ ] **Step 1: Read the full file**

Read `apps/mobile/app/(app)/perfil/index.tsx` entirely. Locate the logout button and the `logout()` call.

- [ ] **Step 2: Add imports and state**

```tsx
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useState } from 'react'

// Inside the component:
const [showLogout, setShowLogout] = useState(false)
```

- [ ] **Step 3: Change logout button to show dialog**

Find the logout Button component. Change its `onPress`:
```tsx
// BEFORE:
onPress={logout}

// AFTER:
onPress={() => setShowLogout(true)}
```

- [ ] **Step 4: Add ConfirmDialog at bottom of JSX**

```tsx
<ConfirmDialog
  visible={showLogout}
  title="Sair da conta"
  message="Tem certeza que deseja sair? Dados não sincronizados podem ser perdidos."
  confirmLabel="Sair"
  cancelLabel="Cancelar"
  variant="danger"
  onConfirm={() => {
    setShowLogout(false)
    void logout()
  }}
  onCancel={() => setShowLogout(false)}
/>
```

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(app)/perfil/index.tsx"
git commit -m "feat(mobile): add logout confirmation dialog on profile screen"
```

---

### Task 8: Vistoria Entrada — confirm + toast on concluir

**Files:**
- Modify: `apps/mobile/app/(app)/vistoria/entrada/[osId].tsx`

- [ ] **Step 1: Read the full file**

Read `apps/mobile/app/(app)/vistoria/entrada/[osId].tsx` entirely. Locate:
1. The `handleConcluir` function (around line 135-147)
2. The "Concluir Vistoria" footer button (around line 307-321)

- [ ] **Step 2: Add imports and state**

```tsx
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/stores/toast.store'

// Inside the component:
const [showConcluir, setShowConcluir] = useState(false)
```

- [ ] **Step 3: Change Concluir button to show dialog**

Find the Concluir button's `onPress`:
```tsx
// BEFORE:
onPress={handleConcluir}

// AFTER:
onPress={() => setShowConcluir(true)}
```

- [ ] **Step 4: Add toast to handleConcluir**

Modify `handleConcluir` to add feedback:
```tsx
// After successful status update:
toast.success('Vistoria de entrada concluída')

// In catch block:
toast.error('Erro ao concluir vistoria')
```

- [ ] **Step 5: Add ConfirmDialog at bottom of JSX**

```tsx
<ConfirmDialog
  visible={showConcluir}
  title="Concluir Vistoria de Entrada"
  message="Após concluir, o status da OS será atualizado. Deseja continuar?"
  confirmLabel="Concluir"
  cancelLabel="Voltar"
  onConfirm={() => {
    setShowConcluir(false)
    handleConcluir()
  }}
  onCancel={() => setShowConcluir(false)}
/>
```

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(app)/vistoria/entrada/[osId].tsx"
git commit -m "feat(mobile): add confirmation dialog and toast to vistoria entrada"
```

---

### Task 9: Vistoria Saída — confirm + toast on concluir

**Files:**
- Modify: `apps/mobile/app/(app)/vistoria/saida/[osId].tsx`

- [ ] **Step 1: Read the full file**

Read `apps/mobile/app/(app)/vistoria/saida/[osId].tsx` entirely. Locate:
1. The `handleConcluir` function (around line 311-322)
2. The "Concluir Vistoria Final" footer button (around line 493-526)

- [ ] **Step 2: Add imports and state**

```tsx
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/stores/toast.store'

// Inside the component:
const [showConcluir, setShowConcluir] = useState(false)
```

- [ ] **Step 3: Change Concluir button to show dialog**

Find the Concluir button's `onPress`:
```tsx
// BEFORE:
onPress={handleConcluir}

// AFTER:
onPress={() => setShowConcluir(true)}
```

- [ ] **Step 4: Add toast to handleConcluir**

Modify `handleConcluir` to add feedback:
```tsx
// After successful status update:
toast.success('Vistoria final concluída — OS pronta para entrega')

// In catch block:
toast.error('Erro ao concluir vistoria final')
```

- [ ] **Step 5: Add ConfirmDialog at bottom of JSX**

```tsx
<ConfirmDialog
  visible={showConcluir}
  title="Concluir Vistoria Final"
  message="Após concluir, a OS será marcada como pronta para entrega. Deseja continuar?"
  confirmLabel="Concluir"
  cancelLabel="Voltar"
  onConfirm={() => {
    setShowConcluir(false)
    handleConcluir()
  }}
  onCancel={() => setShowConcluir(false)}
/>
```

- [ ] **Step 6: Commit**

```bash
git add "apps/mobile/app/(app)/vistoria/saida/[osId].tsx"
git commit -m "feat(mobile): add confirmation dialog and toast to vistoria saída"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] Toast primitive (store + component) — Tasks 1-2
   - [x] ConfirmDialog primitive — Task 3
   - [x] StepIndicator primitive — Task 4
   - [x] Toast on status transition — Task 5
   - [x] Toast on OS creation — Task 6
   - [x] StepIndicator in Nova OS — Task 6
   - [x] Back confirmation in Nova OS — Task 6
   - [x] Logout confirmation — Task 7
   - [x] Concluir vistoria entrada confirmation + toast — Task 8
   - [x] Concluir vistoria saída confirmation + toast — Task 9
   - [x] Mount Toast globally — Task 2 Step 2

2. **Placeholder scan:** All steps have code. No TBD/TODO found.

3. **Type consistency:**
   - `ToastVariant` = `'success' | 'error' | 'warning' | 'info'` — consistent across store and component
   - `toast.success()` / `toast.error()` — same API in store and all integration tasks
   - `ConfirmDialog` props: `visible, title, message, confirmLabel, cancelLabel, variant, loading, onConfirm, onCancel` — consistent across Tasks 7-9
   - `StepIndicator` props: `current, total, labels` — consistent in Task 4 and Task 6

---

## Execution Notes

**Parallelism:** Workstream 1 (Tasks 1-4) must run first since Workstream 2 depends on the primitives. Within each workstream, tasks are sequential.

**Recommended agent split:**
- **Agent 1:** Tasks 1-4 (build primitives)
- **Agent 2:** Tasks 5-9 (integrate — runs AFTER Agent 1 completes)

**Verification after all tasks complete:**
```bash
# Check for TypeScript errors in mobile
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20

# Verify toast store exports
grep -r "from.*toast.store" apps/mobile/src/ apps/mobile/app/ --include="*.tsx" --include="*.ts"

# Verify ConfirmDialog usage
grep -r "ConfirmDialog" apps/mobile/app/ --include="*.tsx" -l

# Verify StepIndicator usage
grep -r "StepIndicator" apps/mobile/app/ --include="*.tsx" -l
```
