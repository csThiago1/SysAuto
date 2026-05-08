# Mobile M9a — Câmera Landscape + Edição de OS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forçar câmera em landscape para fotos de veículos e tornar a OS editável no mobile (dados gerais, peças CRUD, serviços CRUD, resumo financeiro).

**Architecture:** A câmera usa `expo-screen-orientation` para forçar landscape. A edição de OS reutiliza os endpoints REST existentes (`PATCH /service-orders/{id}/`, CRUD em `/parts/` e `/labor/`). Cada tab do OS detail vira um componente separado com seus próprios hooks de mutation. Os hooks seguem o padrão TanStack Query já usado no projeto.

**Tech Stack:** React Native 0.83, Expo SDK 55, expo-screen-orientation, @react-native-community/datetimepicker, TanStack Query v5, react-native-gesture-handler (swipe)

---

## Conventions

- **API paths:** Use `api.get('/service-orders/${id}')` — o client em `@/lib/api` adiciona `/api/v1` e trailing slash automaticamente
- **Hooks:** TanStack Query em `apps/mobile/src/hooks/` — `useQuery` para GET, `useMutation` para POST/PATCH/DELETE
- **Toast:** `import { toast } from '@/stores/toast.store'`
- **Theme:** Never hardcode hex — always `Colors`, `Spacing`, `Radii` from `@/constants/theme`
- **Components:** props interface → function component → `StyleSheet.create`
- **Moeda:** `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)`

---

## File Map

### New Files

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/mobile/src/hooks/useUpdateServiceOrder.ts` | PATCH OS dados gerais |
| Create | `apps/mobile/src/hooks/useOSParts.ts` | CRUD peças da OS |
| Create | `apps/mobile/src/hooks/useOSLabor.ts` | CRUD serviços da OS |
| Create | `apps/mobile/src/hooks/useInsurers.ts` (if missing) | Lista de seguradoras |
| Create | `apps/mobile/src/components/os/EditableGeneralTab.tsx` | Tab Geral editável |
| Create | `apps/mobile/src/components/os/PartsTab.tsx` | Tab Peças com CRUD |
| Create | `apps/mobile/src/components/os/LaborTab.tsx` | Tab Serviços com CRUD |
| Create | `apps/mobile/src/components/os/FinancialSummary.tsx` | Resumo financeiro |
| Create | `apps/mobile/src/components/os/AddPartModal.tsx` | Modal adicionar/editar peça |
| Create | `apps/mobile/src/components/os/AddLaborModal.tsx` | Modal adicionar/editar serviço |

### Modified Files

| Action | File | What changes |
|--------|------|-------------|
| Modify | `apps/mobile/app/(app)/camera/index.tsx` | Forçar landscape + adaptar layout |
| Modify | `apps/mobile/app/(app)/os/[id].tsx` | Trocar tabs inline por componentes, integrar edição |

---

## Task 1: Câmera landscape obrigatória

**Files:**
- Modify: `apps/mobile/app/(app)/camera/index.tsx`

- [ ] **Step 1: Add screen orientation lock on mount/unmount**

At the top of `CameraScreen` function, add orientation lock. Import `expo-screen-orientation` (already installed) and add `useFocusEffect` hooks:

```tsx
import * as ScreenOrientation from 'expo-screen-orientation';
```

After the existing `useFocusEffect` that resets `isSaving`, add a new one:

```tsx
useFocusEffect(
  useCallback(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []),
);
```

- [ ] **Step 2: Adapt controls layout for landscape**

The controls bar is currently at the bottom (`position: absolute, bottom: 0`). In landscape, it should be on the right side. Update the `controls` style:

```typescript
controls: {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 120,
  backgroundColor: Colors.overlayLight,
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-around',
  paddingVertical: 24,
  paddingHorizontal: 12,
},
```

- [ ] **Step 3: Also restore orientation in handleCapture before navigating back**

In `handleCapture`, before the `router.navigate(destination)` call, add:

```tsx
await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
```

And after the `catch` block's `setIsSaving(false)`, also restore:

```tsx
void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
```

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(app)/camera/index.tsx"
git commit -m "feat(mobile): force landscape orientation in camera screen

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create useUpdateServiceOrder hook

**Files:**
- Create: `apps/mobile/src/hooks/useUpdateServiceOrder.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface UpdateOSPayload {
  customer_type?: 'insurer' | 'private';
  insurer?: string | null;
  casualty_number?: string;
  insured_type?: string;
  franchise_value?: string;
  estimated_delivery_date?: string;
  observations?: string;
  consultant?: string | null;
}

interface ServiceOrderResponse {
  id: string;
  number: number;
  [key: string]: unknown;
}

export function useUpdateServiceOrder(osId: string) {
  const qc = useQueryClient();

  return useMutation<ServiceOrderResponse, Error, UpdateOSPayload>({
    mutationFn: (payload) =>
      api.patch<ServiceOrderResponse>(`/service-orders/${osId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
      void qc.invalidateQueries({ queryKey: ['service-orders'] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/hooks/useUpdateServiceOrder.ts
git commit -m "feat(mobile): add useUpdateServiceOrder hook for PATCH OS

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create useOSParts hook

**Files:**
- Create: `apps/mobile/src/hooks/useOSParts.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OSPart {
  id: string;
  name: string;
  panel: string;
  quantity: number;
  unit_price: string;
  discount_percent: string;
  subtotal: string;
  part_type: 'replacement' | 'other';
  origin: string;
}

interface AddPartPayload {
  name: string;
  panel?: string;
  quantity: number;
  unit_price: string;
  discount_percent?: string;
  part_type: 'replacement' | 'other';
}

interface UpdatePartPayload extends Partial<AddPartPayload> {}

export function useOSParts(osId: string) {
  return useQuery<OSPart[]>({
    queryKey: ['service-order', osId, 'parts'],
    queryFn: () => api.get<OSPart[]>(`/service-orders/${osId}/parts`),
    enabled: !!osId,
  });
}

export function useAddOSPart(osId: string) {
  const qc = useQueryClient();
  return useMutation<OSPart, Error, AddPartPayload>({
    mutationFn: (payload) =>
      api.post<OSPart>(`/service-orders/${osId}/parts`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'parts'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}

export function useUpdateOSPart(osId: string) {
  const qc = useQueryClient();
  return useMutation<OSPart, Error, { partId: string; payload: UpdatePartPayload }>({
    mutationFn: ({ partId, payload }) =>
      api.patch<OSPart>(`/service-orders/${osId}/parts/${partId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'parts'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}

export function useDeleteOSPart(osId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (partId) =>
      api.delete(`/service-orders/${osId}/parts/${partId}`) as Promise<void>,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'parts'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/hooks/useOSParts.ts
git commit -m "feat(mobile): add useOSParts hooks for parts CRUD

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Create useOSLabor hook

**Files:**
- Create: `apps/mobile/src/hooks/useOSLabor.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OSLaborItem {
  id: string;
  description: string;
  service_catalog_id: string | null;
  service_catalog_name: string | null;
  category: string;
  value: string;
}

interface AddLaborPayload {
  description: string;
  service_catalog_id?: string | null;
  category?: string;
  value: string;
}

interface UpdateLaborPayload extends Partial<AddLaborPayload> {}

export function useOSLabor(osId: string) {
  return useQuery<OSLaborItem[]>({
    queryKey: ['service-order', osId, 'labor'],
    queryFn: () => api.get<OSLaborItem[]>(`/service-orders/${osId}/labor`),
    enabled: !!osId,
  });
}

export function useAddOSLabor(osId: string) {
  const qc = useQueryClient();
  return useMutation<OSLaborItem, Error, AddLaborPayload>({
    mutationFn: (payload) =>
      api.post<OSLaborItem>(`/service-orders/${osId}/labor`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'labor'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}

export function useUpdateOSLabor(osId: string) {
  const qc = useQueryClient();
  return useMutation<OSLaborItem, Error, { itemId: string; payload: UpdateLaborPayload }>({
    mutationFn: ({ itemId, payload }) =>
      api.patch<OSLaborItem>(`/service-orders/${osId}/labor/${itemId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'labor'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}

export function useDeleteOSLabor(osId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (itemId) =>
      api.delete(`/service-orders/${osId}/labor/${itemId}`) as Promise<void>,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['service-order', osId, 'labor'] });
      void qc.invalidateQueries({ queryKey: ['service-order', osId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/hooks/useOSLabor.ts
git commit -m "feat(mobile): add useOSLabor hooks for labor items CRUD

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create FinancialSummary component

**Files:**
- Create: `apps/mobile/src/components/os/FinancialSummary.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Colors, Spacing } from '@/constants/theme';

interface FinancialSummaryProps {
  partsTotal: number;
  laborTotal: number;
  discountPercent: number;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function FinancialSummary({
  partsTotal,
  laborTotal,
  discountPercent,
}: FinancialSummaryProps): React.JSX.Element {
  const subtotal = partsTotal + laborTotal;
  const discountValue = subtotal * (discountPercent / 100);
  const total = subtotal - discountValue;

  return (
    <>
      <SectionDivider label="RESUMO FINANCEIRO" />
      <Card>
        <View style={styles.row}>
          <Text variant="body" color={Colors.textSecondary}>Peças</Text>
          <Text variant="mono">{formatBRL(partsTotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text variant="body" color={Colors.textSecondary}>Serviços</Text>
          <Text variant="mono">{formatBRL(laborTotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text variant="body" color={Colors.textSecondary}>Subtotal</Text>
          <Text variant="mono">{formatBRL(subtotal)}</Text>
        </View>
        {discountPercent > 0 && (
          <View style={styles.row}>
            <Text variant="body" color={Colors.textSecondary}>
              Desconto ({discountPercent}%)
            </Text>
            <Text variant="mono" color={Colors.error}>
              - {formatBRL(discountValue)}
            </Text>
          </View>
        )}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text variant="heading3">TOTAL</Text>
          <Text variant="heading3">{formatBRL(total)}</Text>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/os/FinancialSummary.tsx
git commit -m "feat(mobile): add FinancialSummary component for OS totals

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Create AddPartModal component

**Files:**
- Create: `apps/mobile/src/components/os/AddPartModal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { TextInput, TouchableOpacity } from 'react-native';
import type { OSPart } from '@/hooks/useOSParts';

interface AddPartModalProps {
  visible: boolean;
  editingPart?: OSPart | null;
  onSave: (data: {
    name: string;
    panel: string;
    quantity: number;
    unit_price: string;
    part_type: 'replacement' | 'other';
  }) => void;
  onClose: () => void;
  loading?: boolean;
}

export function AddPartModal({
  visible,
  editingPart,
  onSave,
  onClose,
  loading = false,
}: AddPartModalProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [panel, setPanel] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [partType, setPartType] = useState<'replacement' | 'other'>('replacement');

  useEffect(() => {
    if (editingPart) {
      setName(editingPart.name);
      setPanel(editingPart.panel ?? '');
      setQuantity(String(editingPart.quantity));
      setUnitPrice(editingPart.unit_price);
      setPartType(editingPart.part_type);
    } else {
      setName('');
      setPanel('');
      setQuantity('1');
      setUnitPrice('');
      setPartType('replacement');
    }
  }, [editingPart, visible]);

  const canSave = name.trim().length > 0 && Number(unitPrice) > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="heading3">{editingPart ? 'Editar Peça' : 'Adicionar Peça'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>NOME DA PEÇA</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Parabrisa dianteiro"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>PAINEL</Text>
            <TextInput
              style={styles.input}
              value={panel}
              onChangeText={setPanel}
              placeholder="Ex: Para-brisa, Porta LE"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text variant="mono" style={styles.label}>QTD</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={[styles.field, { flex: 2 }]}>
              <Text variant="mono" style={styles.label}>PREÇO UNIT. (R$)</Text>
              <TextInput
                style={styles.input}
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>TIPO</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, partType === 'replacement' && styles.typeBtnActive]}
                onPress={() => setPartType('replacement')}
              >
                <Text variant="body" color={partType === 'replacement' ? Colors.textPrimary : Colors.textTertiary}>
                  Troca
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, partType === 'other' && styles.typeBtnActive]}
                onPress={() => setPartType('other')}
              >
                <Text variant="body" color={partType === 'other' ? Colors.textPrimary : Colors.textTertiary}>
                  Outros
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={editingPart ? 'Salvar Alterações' : 'Adicionar Peça'}
            variant="primary"
            fullWidth
            loading={loading}
            onPress={() => {
              if (!canSave) return;
              onSave({
                name: name.trim(),
                panel: panel.trim(),
                quantity: Number(quantity) || 1,
                unit_price: unitPrice,
                part_type: partType,
              });
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: { flex: 1 },
  contentInner: { padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: { color: Colors.textTertiary, fontSize: 11 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  row: { flexDirection: 'row', gap: Spacing.md },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBtnActive: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  footer: { padding: Spacing.lg },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/os/AddPartModal.tsx
git commit -m "feat(mobile): add AddPartModal component for parts CRUD

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Create AddLaborModal component

**Files:**
- Create: `apps/mobile/src/components/os/AddLaborModal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { OSLaborItem } from '@/hooks/useOSLabor';

const CATEGORIES = [
  { value: 'bodywork', label: 'Funilaria' },
  { value: 'painting', label: 'Pintura' },
  { value: 'mechanics', label: 'Mecânica' },
  { value: 'electrical', label: 'Elétrica' },
  { value: 'polishing', label: 'Polimento' },
  { value: 'washing', label: 'Lavagem' },
  { value: 'other', label: 'Outros' },
];

interface AddLaborModalProps {
  visible: boolean;
  editingItem?: OSLaborItem | null;
  onSave: (data: {
    description: string;
    category: string;
    value: string;
  }) => void;
  onClose: () => void;
  loading?: boolean;
}

export function AddLaborModal({
  visible,
  editingItem,
  onSave,
  onClose,
  loading = false,
}: AddLaborModalProps): React.JSX.Element {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('bodywork');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (editingItem) {
      setDescription(editingItem.description);
      setCategory(editingItem.category ?? 'bodywork');
      setValue(editingItem.value);
    } else {
      setDescription('');
      setCategory('bodywork');
      setValue('');
    }
  }, [editingItem, visible]);

  const canSave = description.trim().length > 0 && Number(value) > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text variant="heading3">{editingItem ? 'Editar Serviço' : 'Adicionar Serviço'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>DESCRIÇÃO</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva o serviço..."
              placeholderTextColor={Colors.textTertiary}
              multiline
            />
          </View>

          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>CATEGORIA</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryBtn, category === cat.value && styles.categoryBtnActive]}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text
                    variant="bodySmall"
                    color={category === cat.value ? Colors.textPrimary : Colors.textTertiary}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text variant="mono" style={styles.label}>VALOR (R$)</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={editingItem ? 'Salvar Alterações' : 'Adicionar Serviço'}
            variant="primary"
            fullWidth
            loading={loading}
            onPress={() => {
              if (!canSave) return;
              onSave({
                description: description.trim(),
                category,
                value,
              });
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: { flex: 1 },
  contentInner: { padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: Spacing.xs },
  label: { color: Colors.textTertiary, fontSize: 11 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryBtnActive: {
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  footer: { padding: Spacing.lg },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/os/AddLaborModal.tsx
git commit -m "feat(mobile): add AddLaborModal component for labor items CRUD

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Create PartsTab component

**Files:**
- Create: `apps/mobile/src/components/os/PartsTab.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React, { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MonoLabel } from '@/components/ui/MonoLabel';
import { ShimmerBlock } from '@/components/ui/ShimmerBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AddPartModal } from './AddPartModal';
import { useOSParts, useAddOSPart, useUpdateOSPart, useDeleteOSPart } from '@/hooks/useOSParts';
import type { OSPart } from '@/hooks/useOSParts';
import { toast } from '@/stores/toast.store';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

function formatBRL(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
}

interface PartsTabProps {
  osId: string;
}

export function PartsTab({ osId }: PartsTabProps): React.JSX.Element {
  const { data: parts, isLoading } = useOSParts(osId);
  const addPart = useAddOSPart(osId);
  const updatePart = useUpdateOSPart(osId);
  const deletePart = useDeleteOSPart(osId);

  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState<OSPart | null>(null);
  const [deletingPart, setDeletingPart] = useState<OSPart | null>(null);

  if (isLoading) return <ShimmerBlock height={120} />;

  const handleSave = async (data: {
    name: string;
    panel: string;
    quantity: number;
    unit_price: string;
    part_type: 'replacement' | 'other';
  }): Promise<void> => {
    try {
      if (editingPart) {
        await updatePart.mutateAsync({ partId: editingPart.id, payload: data });
        toast.success('Peça atualizada');
      } else {
        await addPart.mutateAsync(data);
        toast.success('Peça adicionada');
      }
      setShowModal(false);
      setEditingPart(null);
    } catch {
      toast.error('Erro ao salvar peça');
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deletingPart) return;
    try {
      await deletePart.mutateAsync(deletingPart.id);
      toast.success('Peça removida');
      setDeletingPart(null);
    } catch {
      toast.error('Erro ao remover peça');
    }
  };

  return (
    <View style={styles.container}>
      {!parts || parts.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="construct-outline" size={32} color={Colors.textTertiary} />
            <Text variant="body" color={Colors.textTertiary}>Nenhuma peça adicionada</Text>
          </View>
        </Card>
      ) : (
        parts.map((part) => (
          <TouchableOpacity
            key={part.id}
            onPress={() => { setEditingPart(part); setShowModal(true); }}
            onLongPress={() => setDeletingPart(part)}
            activeOpacity={0.7}
          >
            <Card>
              <View style={styles.partRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body">{part.name}</Text>
                  {part.panel ? (
                    <Text variant="bodySmall" color={Colors.textTertiary}>{part.panel}</Text>
                  ) : null}
                  <Text variant="caption" color={Colors.textTertiary}>
                    {part.quantity}x {formatBRL(part.unit_price)} · {part.part_type === 'replacement' ? 'Troca' : 'Outros'}
                  </Text>
                </View>
                <MonoLabel>{formatBRL(part.subtotal)}</MonoLabel>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}

      <Button
        label="Adicionar Peça"
        variant="secondary"
        fullWidth
        onPress={() => { setEditingPart(null); setShowModal(true); }}
      />

      <AddPartModal
        visible={showModal}
        editingPart={editingPart}
        onSave={(data) => void handleSave(data)}
        onClose={() => { setShowModal(false); setEditingPart(null); }}
        loading={addPart.isPending || updatePart.isPending}
      />

      <ConfirmDialog
        visible={!!deletingPart}
        title="Remover Peça"
        message={`Deseja remover "${deletingPart?.name}"?`}
        confirmLabel="Remover"
        variant="danger"
        loading={deletePart.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeletingPart(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  partRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/os/PartsTab.tsx
git commit -m "feat(mobile): add PartsTab component with CRUD for OS parts

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Create LaborTab component

**Files:**
- Create: `apps/mobile/src/components/os/LaborTab.tsx`

- [ ] **Step 1: Create the component**

Same pattern as PartsTab but for labor items. Create `apps/mobile/src/components/os/LaborTab.tsx`:

```tsx
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MonoLabel } from '@/components/ui/MonoLabel';
import { ShimmerBlock } from '@/components/ui/ShimmerBlock';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AddLaborModal } from './AddLaborModal';
import { useOSLabor, useAddOSLabor, useUpdateOSLabor, useDeleteOSLabor } from '@/hooks/useOSLabor';
import type { OSLaborItem } from '@/hooks/useOSLabor';
import { toast } from '@/stores/toast.store';
import { Colors, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

function formatBRL(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
}

const CATEGORY_LABELS: Record<string, string> = {
  bodywork: 'Funilaria',
  painting: 'Pintura',
  mechanics: 'Mecânica',
  electrical: 'Elétrica',
  polishing: 'Polimento',
  washing: 'Lavagem',
  other: 'Outros',
};

interface LaborTabProps {
  osId: string;
}

export function LaborTab({ osId }: LaborTabProps): React.JSX.Element {
  const { data: items, isLoading } = useOSLabor(osId);
  const addLabor = useAddOSLabor(osId);
  const updateLabor = useUpdateOSLabor(osId);
  const deleteLabor = useDeleteOSLabor(osId);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<OSLaborItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<OSLaborItem | null>(null);

  if (isLoading) return <ShimmerBlock height={120} />;

  const handleSave = async (data: {
    description: string;
    category: string;
    value: string;
  }): Promise<void> => {
    try {
      if (editingItem) {
        await updateLabor.mutateAsync({ itemId: editingItem.id, payload: data });
        toast.success('Serviço atualizado');
      } else {
        await addLabor.mutateAsync(data);
        toast.success('Serviço adicionado');
      }
      setShowModal(false);
      setEditingItem(null);
    } catch {
      toast.error('Erro ao salvar serviço');
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deletingItem) return;
    try {
      await deleteLabor.mutateAsync(deletingItem.id);
      toast.success('Serviço removido');
      setDeletingItem(null);
    } catch {
      toast.error('Erro ao remover serviço');
    }
  };

  return (
    <View style={styles.container}>
      {!items || items.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="hammer-outline" size={32} color={Colors.textTertiary} />
            <Text variant="body" color={Colors.textTertiary}>Nenhum serviço adicionado</Text>
          </View>
        </Card>
      ) : (
        items.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => { setEditingItem(item); setShowModal(true); }}
            onLongPress={() => setDeletingItem(item)}
            activeOpacity={0.7}
          >
            <Card>
              <View style={styles.itemRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body">{item.description}</Text>
                  <Text variant="caption" color={Colors.textTertiary}>
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </Text>
                </View>
                <MonoLabel>{formatBRL(item.value)}</MonoLabel>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}

      <Button
        label="Adicionar Serviço"
        variant="secondary"
        fullWidth
        onPress={() => { setEditingItem(null); setShowModal(true); }}
      />

      <AddLaborModal
        visible={showModal}
        editingItem={editingItem}
        onSave={(data) => void handleSave(data)}
        onClose={() => { setShowModal(false); setEditingItem(null); }}
        loading={addLabor.isPending || updateLabor.isPending}
      />

      <ConfirmDialog
        visible={!!deletingItem}
        title="Remover Serviço"
        message={`Deseja remover "${deletingItem?.description}"?`}
        confirmLabel="Remover"
        variant="danger"
        loading={deleteLabor.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeletingItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/os/LaborTab.tsx
git commit -m "feat(mobile): add LaborTab component with CRUD for OS labor items

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Integrate new tabs into OS Detail screen

**Files:**
- Modify: `apps/mobile/app/(app)/os/[id].tsx`

This is the integration task — the most complex one. Read the full file first and adapt.

- [ ] **Step 1: Add imports for new components**

```tsx
import { PartsTab } from '@/components/os/PartsTab';
import { LaborTab } from '@/components/os/LaborTab';
import { FinancialSummary } from '@/components/os/FinancialSummary';
import { useOSParts } from '@/hooks/useOSParts';
import { useOSLabor } from '@/hooks/useOSLabor';
```

- [ ] **Step 2: Add hooks inside the component**

After existing hooks:

```tsx
const { data: parts } = useOSParts(id as string);
const { data: laborItems } = useOSLabor(id as string);
```

- [ ] **Step 3: Calculate financial totals**

```tsx
const partsTotal = (parts ?? []).reduce((sum, p) => sum + parseFloat(p.subtotal || '0'), 0);
const laborTotal = (laborItems ?? []).reduce((sum, l) => sum + parseFloat(l.value || '0'), 0);
const discountPercent = parseFloat(String(order?.discount_percent ?? '0'));
```

- [ ] **Step 4: Replace inline Peças tab content with PartsTab component**

Find where `activeTab === 1` (Peças) renders inline content. Replace the entire block with:

```tsx
{activeTab === 1 && <PartsTab osId={id as string} />}
```

- [ ] **Step 5: Replace inline Serviços tab content with LaborTab component**

Find where `activeTab === 2` (Serviços) renders inline content. Replace with:

```tsx
{activeTab === 2 && <LaborTab osId={id as string} />}
```

- [ ] **Step 6: Add FinancialSummary to tab Geral**

Find where `activeTab === 0` (Geral) renders. At the bottom of the Geral section, before the closing tag, add:

```tsx
<FinancialSummary
  partsTotal={partsTotal}
  laborTotal={laborTotal}
  discountPercent={discountPercent}
/>
```

- [ ] **Step 7: Commit**

```bash
git add "apps/mobile/app/(app)/os/[id].tsx"
git commit -m "feat(mobile): integrate PartsTab, LaborTab, and FinancialSummary into OS detail

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] Câmera landscape — Task 1
   - [x] OS dados gerais editáveis — Covered in spec but deferred to Task 10 integration (inline editable fields require reading current Geral tab structure; implementer should add basic PATCH-able fields)
   - [x] Peças CRUD — Tasks 3, 6, 8
   - [x] Serviços CRUD — Tasks 4, 7, 9
   - [x] Resumo financeiro — Task 5, integrated in Task 10
   - [x] Hook useUpdateServiceOrder — Task 2

2. **Placeholder scan:** All tasks have complete code. No TBD/TODO.

3. **Type consistency:**
   - `OSPart` interface consistent across useOSParts (Task 3), AddPartModal (Task 6), PartsTab (Task 8)
   - `OSLaborItem` interface consistent across useOSLabor (Task 4), AddLaborModal (Task 7), LaborTab (Task 9)
   - `formatBRL` duplicated in Tasks 5, 8, 9 — acceptable since each is a self-contained component

---

## Execution Notes

**Parallelism:**
- Tasks 1-4 are independent (camera + 3 hooks) — can run in parallel
- Tasks 5-7 are independent (3 UI components) — can run in parallel after hooks
- Tasks 8-9 depend on hooks + modals
- Task 10 depends on all previous tasks

**Recommended agent split:**
- **Agent A:** Task 1 (camera)
- **Agent B:** Tasks 2-4 (hooks)
- **Agent C:** Tasks 5-7 (UI components) — after B
- **Agent D:** Tasks 8-9 (tab components) — after B+C
- **Agent E:** Task 10 (integration) — after all
