# Wizard de Resolucao de Pendencias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a guided full-screen wizard that helps users resolve all pending requirements before advancing an OS status, replacing the scattered navigation of the current TransitionRequirementsSheet.

**Architecture:** New Stack route `/(app)/os/resolver/[osId]` receives target status as query param. Uses existing `useServiceOrder` hook to fetch `transition_requirements`. Renders a checklist of `ResolutionItem` components — inline forms for data fields, navigation for camera/checklist. Auto-revalidates via `useFocusEffect`. A `PendingRequirements` preview card in GeneralTab shows pending count and links to the wizard.

**Tech Stack:** React Native, Expo Router, TanStack Query, existing `api.patch`/`useTransitionWithValidation`/`useServiceOrder` hooks.

**Spec:** `docs/superpowers/specs/2026-05-11-wizard-resolucao-pendencias-design.md`

---

## File Structure

```
NEW FILES:
  app/(app)/os/resolver/[osId].tsx          — Wizard screen (full-screen Stack route)
  src/components/os/ResolutionItem.tsx       — Single checklist item (resolved/pending/soft)
  src/components/os/InlineField.tsx          — Expandable inline form for data fields
  src/components/os/PendingRequirements.tsx  — Preview card for GeneralTab

MODIFIED FILES:
  app/(app)/os/_layout.tsx                  — Register resolver/[osId] route
  app/(app)/os/[id].tsx                     — Route to wizard instead of sheet when blocks exist
  src/components/os/GeneralTab.tsx           — Add PendingRequirements section
```

---

### Task 1: Register the resolver route

**Files:**
- Modify: `app/(app)/os/_layout.tsx`

- [ ] **Step 1: Add resolver route to OS Stack layout**

In `app/(app)/os/_layout.tsx`, add the resolver screen to the Stack:

```tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function OSLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="resolver/[osId]" options={{ headerShown: false }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Create empty resolver screen placeholder**

Create `app/(app)/os/resolver/[osId].tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/theme';

export default function ResolverScreen(): React.JSX.Element {
  const { osId } = useLocalSearchParams<{ osId: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="body" color={Colors.textPrimary}>Resolver: {osId}</Text>
    </View>
  );
}
```

- [ ] **Step 3: Verify route works**

Run the app, navigate to an OS detail, confirm no crash. The resolver route will be wired in Task 5.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/os/_layout.tsx app/\(app\)/os/resolver/
git commit -m "feat(mobile): register resolver route in OS Stack"
```

---

### Task 2: Build ResolutionItem component

**Files:**
- Create: `src/components/os/ResolutionItem.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/os/ResolutionItem.tsx`:

```tsx
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, SemanticColors, Spacing } from '@/constants/theme';
import type { ValidationBlock } from '@paddock/types';

interface ResolutionItemProps {
  block: ValidationBlock;
  type: 'hard' | 'soft' | 'warn';
  resolved: boolean;
  onAction?: () => void;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
}

export function ResolutionItem({
  block,
  type,
  resolved,
  onAction,
  actionLabel,
  actionIcon,
}: ResolutionItemProps): React.JSX.Element {
  const iconName = resolved
    ? 'checkmark-circle'
    : type === 'soft'
      ? 'lock-closed'
      : type === 'warn'
        ? 'alert-circle'
        : 'ellipse-outline';

  const iconColor = resolved
    ? SemanticColors.success.color
    : type === 'hard'
      ? SemanticColors.error.color
      : type === 'soft'
        ? SemanticColors.warning.color
        : Colors.textTertiary;

  return (
    <View style={[styles.row, resolved && styles.rowResolved]}>
      <Ionicons name={iconName} size={20} color={iconColor} />
      <Text
        variant="bodySmall"
        style={[styles.message, resolved && styles.messageResolved]}
        numberOfLines={2}
      >
        {block.message}
        {type === 'warn' && !resolved && (
          <Text style={styles.optional}> (opcional)</Text>
        )}
      </Text>
      {!resolved && onAction && actionLabel && (
        <TouchableOpacity style={styles.actionChip} onPress={onAction} activeOpacity={0.7}>
          {actionIcon && <Ionicons name={actionIcon} size={14} color={Colors.brand} />}
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={12} color={Colors.brand} />
        </TouchableOpacity>
      )}
      {resolved && (
        <Ionicons name="checkmark" size={16} color={SemanticColors.success.color} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    backgroundColor: 'transparent',
  },
  rowResolved: {
    backgroundColor: 'rgba(52,211,153,0.06)',
  },
  message: {
    flex: 1,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  messageResolved: {
    color: Colors.textSecondary,
  },
  optional: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/os/ResolutionItem.tsx
git commit -m "feat(mobile): add ResolutionItem component for wizard checklist"
```

---

### Task 3: Build InlineField component

**Files:**
- Create: `src/components/os/InlineField.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/os/InlineField.tsx`. This handles expandable inline forms for data codes like `VEHICLE_BASIC_DATA`, `CUSTOMER_TYPE_SET`, `MILEAGE_OUT`, etc.

```tsx
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { toast } from '@/stores/toast.store';

interface FieldConfig {
  key: string;
  label: string;
  keyboard?: 'default' | 'numeric' | 'email-address';
  placeholder?: string;
}

interface InlineFieldProps {
  osId: string;
  code: string;
  fields: FieldConfig[];
  onSaved: () => void;
}

export function InlineField({ osId, code, fields, onSaved }: InlineFieldProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const val = values[field.key]?.trim();
      if (val) {
        payload[field.key] = field.keyboard === 'numeric' ? Number(val) : val;
      }
    }
    if (Object.keys(payload).length === 0) {
      toast.warning('Preencha ao menos um campo');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/service-orders/${osId}/`, payload);
      toast.success('Dados salvos');
      setExpanded(false);
      onSaved();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(true)} activeOpacity={0.7}>
        <Ionicons name="pencil" size={14} color={Colors.brand} />
        <Text style={styles.expandText}>Preencher</Text>
        <Ionicons name="chevron-forward" size={12} color={Colors.brand} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {fields.map((field) => (
        <View key={field.key} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <TextInput
            style={styles.input}
            placeholder={field.placeholder ?? field.label}
            placeholderTextColor={Colors.textTertiary}
            keyboardType={field.keyboard ?? 'default'}
            autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'sentences'}
            value={values[field.key] ?? ''}
            onChangeText={(text) => setValues((prev) => ({ ...prev, [field.key]: text }))}
          />
        </View>
      ))}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setExpanded(false)} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={() => { void handleSave(); }} activeOpacity={0.7} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveText}>Salvar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.brand,
    backgroundColor: Colors.brandTint,
  },
  expandText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand,
  },
  container: {
    marginTop: 8,
    marginLeft: 30,
    backgroundColor: Colors.inputBg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 10,
  },
  fieldRow: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radii.sm,
    backgroundColor: Colors.brand,
  },
  saveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/os/InlineField.tsx
git commit -m "feat(mobile): add InlineField expandable form for wizard"
```

---

### Task 4: Build the Resolver screen

**Files:**
- Modify: `app/(app)/os/resolver/[osId].tsx` (replace placeholder)

- [ ] **Step 1: Implement the full resolver screen**

Replace the placeholder in `app/(app)/os/resolver/[osId].tsx`:

```tsx
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Radii, SemanticColors, Spacing } from '@/constants/theme';
import { useServiceOrder, serviceOrderKeys } from '@/hooks/useServiceOrders';
import {
  useTransitionWithValidation,
  useRequestOverride,
} from '@/hooks/useTransitionValidation';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { useSignatureCapture } from '@/hooks/useSignatureCapture';
import { ResolutionItem } from '@/components/os/ResolutionItem';
import { InlineField } from '@/components/os/InlineField';
import { toast } from '@/stores/toast.store';
import type {
  ServiceOrderStatus,
  TransitionValidationResult,
  ValidationBlock,
} from '@paddock/types';
import type { ServiceOrderDetail } from '@/components/os/os-detail-utils';

// ─── Status labels ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  reception: 'Recepcao', initial_survey: 'Vistoria Inicial', budget: 'Orcamento',
  waiting_auth: 'Ag. Autorizacao', authorized: 'Autorizada', waiting_parts: 'Ag. Pecas',
  repair: 'Reparo', mechanic: 'Mecanica', bodywork: 'Funilaria', painting: 'Pintura',
  assembly: 'Montagem', polishing: 'Polimento', washing: 'Lavagem',
  final_survey: 'Vistoria Final', ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelada',
};

// ─── Inline field configs ───────────────────────────────────────────────────

const INLINE_FIELDS: Record<string, { key: string; label: string; keyboard?: 'numeric' }[]> = {
  VEHICLE_BASIC_DATA: [
    { key: 'plate', label: 'Placa' },
    { key: 'make', label: 'Marca' },
    { key: 'model', label: 'Modelo' },
  ],
  CUSTOMER_TYPE_SET: [{ key: 'customer_type', label: 'Tipo (insurer ou private)' }],
  MILEAGE_OUT: [{ key: 'mileage_out', label: 'KM Saida', keyboard: 'numeric' }],
};

// Codes that navigate to other screens
const NAV_ACTIONS: Record<string, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: (osId: string) => { pathname: string; params?: Record<string, string> };
}> = {
  PHOTOS_MIN_12: {
    label: 'Fazer Vistoria',
    icon: 'camera',
    route: (osId) => ({ pathname: '/(app)/vistoria/entrada/[osId]', params: { osId } }),
  },
  FINAL_PHOTOS_12: {
    label: 'Vistoria Final',
    icon: 'camera',
    route: (osId) => ({ pathname: '/(app)/vistoria/saida/[osId]', params: { osId } }),
  },
  PROGRESS_PHOTO: {
    label: 'Tirar Foto',
    icon: 'camera',
    route: (osId) => ({
      pathname: '/(app)/camera',
      params: { osId, folder: 'acompanhamento', slot: 'extra', checklistType: 'acompanhamento' },
    }),
  },
  EXIT_CHECKLIST: {
    label: 'Preencher Checklist',
    icon: 'checkbox',
    route: (osId) => ({ pathname: '/(app)/checklist/[osId]', params: { osId } }),
  },
  BUDGET_PDF_INSURER: {
    label: 'Enviar PDF',
    icon: 'document-attach',
    route: (osId) => ({
      pathname: '/(app)/camera',
      params: { osId, folder: 'orcamentos', slot: 'extra', checklistType: '' },
    }),
  },
};

const SIGNATURE_CODES = ['CLIENT_SIGNATURE', 'SIGNATURE_APPROVAL'];

// ─── Component ──────────────────────────────────────────────────────────────

export default function ResolverScreen(): React.JSX.Element {
  const { osId } = useLocalSearchParams<{ osId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const target = (useLocalSearchParams<{ target: string }>().target ?? '') as ServiceOrderStatus;

  const { order: rawOrder, isLoading, refetch } = useServiceOrder(osId ?? '');
  const order = rawOrder as ServiceOrderDetail | null;
  const validation: TransitionValidationResult | undefined = order?.transition_requirements?.[target];

  const transitionMutation = useTransitionWithValidation(osId ?? '');
  const overrideMutation = useRequestOverride(osId ?? '');
  const signatureCapture = useSignatureCapture();
  const [showSignature, setShowSignature] = useState(false);
  const [signatureDocType, setSignatureDocType] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Auto-revalidate when screen regains focus (returning from camera/checklist)
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleInlineSaved = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: serviceOrderKeys.detail(osId ?? '') });
    void refetch();
  }, [queryClient, osId, refetch]);

  const hardBlocks = validation?.hard_blocks ?? [];
  const softBlocks = validation?.soft_blocks ?? [];
  const warnings = validation?.warnings ?? [];
  const canProceed = validation?.can_proceed ?? false;
  const hasHardBlocks = hardBlocks.length > 0;
  const hasSoftBlocks = softBlocks.length > 0;
  const hasPendingOverride = validation?.has_pending_override ?? false;
  const targetLabel = STATUS_LABELS[target] ?? target;

  // ── Transition ─────────────────────────────────────────────────────────────

  const handleTransition = async (): Promise<void> => {
    try {
      await transitionMutation.mutateAsync({ new_status: target });
      toast.success(`Status: ${targetLabel}`);
      router.back();
    } catch {
      toast.error('Erro ao avancar status');
    }
  };

  const handleRequestOverride = async (): Promise<void> => {
    try {
      await overrideMutation.mutateAsync({ target_status: target, reason: 'Solicitado via wizard' });
    } catch {
      // Handled by hook onError
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderBlock = (block: ValidationBlock, type: 'hard' | 'soft' | 'warn'): React.JSX.Element => {
    const resolved = false; // If block is in the list, it's not resolved
    const inlineConfig = INLINE_FIELDS[block.code];
    const navAction = NAV_ACTIONS[block.code];
    const isSignature = SIGNATURE_CODES.includes(block.code);

    if (inlineConfig) {
      return (
        <View key={block.code}>
          <ResolutionItem block={block} type={type} resolved={resolved} />
          <InlineField
            osId={osId ?? ''}
            code={block.code}
            fields={inlineConfig}
            onSaved={handleInlineSaved}
          />
        </View>
      );
    }

    return (
      <ResolutionItem
        key={block.code}
        block={block}
        type={type}
        resolved={resolved}
        onAction={
          navAction
            ? () => router.push(navAction.route(osId ?? '') as any)
            : isSignature
              ? () => { setSignatureDocType(block.code === 'CLIENT_SIGNATURE' ? 'OS_DELIVERY' : 'BUDGET_APPROVAL'); setShowSignature(true); }
              : undefined
        }
        actionLabel={navAction?.label ?? (isSignature ? 'Assinar' : undefined)}
        actionIcon={navAction?.icon ?? (isSignature ? 'create' : undefined)}
      />
    );
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading || !order) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Resolver Pendencias</Text>
          <Text style={styles.headerSub}>OS #{order.number} → {targetLabel}</Text>
        </View>
      </View>

      {/* ── Checklist ───────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { void handleRefresh(); }} tintColor={Colors.brand} />
        }
      >
        {/* Hard blocks */}
        {hasHardBlocks && (
          <>
            <Text style={styles.sectionLabel}>OBRIGATORIO</Text>
            {hardBlocks.map((b) => renderBlock(b, 'hard'))}
          </>
        )}

        {/* Soft blocks */}
        {hasSoftBlocks && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>REQUER APROVACAO</Text>
            {softBlocks.map((b) => renderBlock(b, 'soft'))}
          </>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>RECOMENDADO</Text>
            {warnings.map((b) => renderBlock(b, 'warn'))}
          </>
        )}

        {/* All clear */}
        {canProceed && !hasHardBlocks && !hasSoftBlocks && (
          <View style={styles.allClear}>
            <Ionicons name="checkmark-circle" size={32} color={SemanticColors.success.color} />
            <Text style={styles.allClearText}>Todos os requisitos atendidos!</Text>
          </View>
        )}

        {/* Pending override banner */}
        {hasPendingOverride && (
          <View style={styles.pendingBanner}>
            <ActivityIndicator size="small" color={SemanticColors.info.color} />
            <Text style={styles.pendingText}>Liberacao pendente — aguardando gerente</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Footer button ───────────────────────────────────────────────── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {canProceed ? (
          <Button
            label={`Avancar para ${targetLabel}`}
            onPress={() => { void handleTransition(); }}
            loading={transitionMutation.isPending}
          />
        ) : hasHardBlocks ? (
          <Button label="Preencha os campos obrigatorios" disabled variant="secondary" />
        ) : hasSoftBlocks && !hasPendingOverride ? (
          <Button
            label="Solicitar Liberacao"
            onPress={() => { void handleRequestOverride(); }}
            loading={overrideMutation.isPending}
            variant="secondary"
          />
        ) : hasPendingOverride ? (
          <Button label="Aguardando aprovacao..." disabled variant="secondary" />
        ) : null}
      </View>

      {/* ── Signature modal ─────────────────────────────────────────────── */}
      <Modal visible={showSignature} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSignature(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.bg, padding: Spacing.lg, paddingTop: insets.top + Spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg }}>
            <Text variant="heading3" color={Colors.textPrimary}>Assinatura</Text>
            <TouchableOpacity onPress={() => setShowSignature(false)}>
              <Ionicons name="close" size={24} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <SignatureCanvas
            height={250}
            signerName={order.customer_name}
            onSave={async (base64) => {
              try {
                await signatureCapture.mutateAsync({
                  service_order_id: order.number,
                  document_type: signatureDocType,
                  signer_name: order.customer_name,
                  signature_png_base64: base64,
                });
                toast.success('Assinatura registrada');
              } catch {
                toast.error('Erro ao registrar assinatura');
              }
              setShowSignature(false);
              void refetch();
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  allClear: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  allClearText: { fontSize: 15, fontWeight: '600', color: SemanticColors.success.color },
  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: SemanticColors.info.border,
    backgroundColor: SemanticColors.info.bg, borderRadius: Radii.sm,
    padding: Spacing.md, marginTop: Spacing.lg,
  },
  pendingText: { flex: 1, fontSize: 13, color: SemanticColors.info.color },
  footer: {
    paddingHorizontal: Spacing.lg, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.bg,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep resolver`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/os/resolver/\[osId\].tsx
git commit -m "feat(mobile): implement resolver wizard screen"
```

---

### Task 5: Wire up os/[id].tsx to navigate to wizard

**Files:**
- Modify: `app/(app)/os/[id].tsx`

- [ ] **Step 1: Change handleSelectStatus to navigate to wizard when blocks exist**

In `app/(app)/os/[id].tsx`, find the `handleSelectStatus` callback (around line 151) and replace it:

```tsx
  const handleSelectStatus = useCallback((newStatus: ServiceOrderStatus): void => {
    setStatusModalVisible(false);
    const validation = order?.transition_requirements?.[newStatus];
    const hasBlocks =
      (validation?.hard_blocks?.length ?? 0) > 0 ||
      (validation?.soft_blocks?.length ?? 0) > 0;

    if (hasBlocks) {
      // Navigate to guided wizard
      router.push({
        pathname: '/(app)/os/resolver/[osId]',
        params: { osId: id ?? '', target: newStatus },
      });
    } else {
      // No blocks — open requirements sheet for direct transition
      setRequirementsTarget(newStatus);
    }
  }, [order, router, id]);
```

- [ ] **Step 2: Verify the flow works**

Run the app, open an OS in reception status, tap "Avancar Status", select "Vistoria Inicial". If blocks exist, the wizard screen should open instead of the bottom sheet.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/os/\[id\].tsx
git commit -m "feat(mobile): route to wizard when transition has blocks"
```

---

### Task 6: Build PendingRequirements preview for GeneralTab

**Files:**
- Create: `src/components/os/PendingRequirements.tsx`
- Modify: `src/components/os/GeneralTab.tsx`

- [ ] **Step 1: Create PendingRequirements component**

Create `src/components/os/PendingRequirements.tsx`:

```tsx
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Colors, SemanticColors, Spacing } from '@/constants/theme';
import { VALID_TRANSITIONS } from '@paddock/types';
import type { ServiceOrderStatus, TransitionRequirements } from '@paddock/types';

const STATUS_LABELS: Record<string, string> = {
  reception: 'Recepcao', initial_survey: 'Vistoria Inicial', budget: 'Orcamento',
  waiting_auth: 'Ag. Autorizacao', authorized: 'Autorizada', waiting_parts: 'Ag. Pecas',
  repair: 'Reparo', mechanic: 'Mecanica', bodywork: 'Funilaria', painting: 'Pintura',
  assembly: 'Montagem', polishing: 'Polimento', washing: 'Lavagem',
  final_survey: 'Vistoria Final', ready: 'Pronto', delivered: 'Entregue',
};

interface Props {
  currentStatus: string;
  transitionRequirements?: TransitionRequirements;
  onPress: (targetStatus: ServiceOrderStatus) => void;
}

export function PendingRequirements({ currentStatus, transitionRequirements, onPress }: Props): React.JSX.Element | null {
  if (!transitionRequirements) return null;

  const nextStatuses = VALID_TRANSITIONS[currentStatus as ServiceOrderStatus] ?? [];
  const firstTarget = nextStatuses[0];
  if (!firstTarget) return null;

  const validation = transitionRequirements[firstTarget];
  if (!validation) return null;

  const hardCount = validation.hard_blocks?.length ?? 0;
  const softCount = validation.soft_blocks?.length ?? 0;
  const totalPending = hardCount + softCount;

  if (totalPending === 0) return null;

  const targetLabel = STATUS_LABELS[firstTarget] ?? firstTarget;

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name="alert-circle" size={20} color={SemanticColors.warning.color} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>Para avancar</Text>
          <Text style={styles.subtitle}>
            {totalPending} pendencia{totalPending > 1 ? 's' : ''} para {targetLabel}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.resolveBtn}
          onPress={() => onPress(firstTarget)}
          activeOpacity={0.7}
        >
          <Text style={styles.resolveBtnText}>Resolver</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.brand} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.warning.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.brandTint,
    borderWidth: 1,
    borderColor: Colors.brand,
  },
  resolveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand,
  },
});
```

- [ ] **Step 2: Add PendingRequirements to GeneralTab**

In `src/components/os/GeneralTab.tsx`, add the import and render it after ChecklistProgressRow:

Add import at the top:
```tsx
import { PendingRequirements } from './PendingRequirements';
import { useRouter } from 'expo-router';
```

Add `osId` usage. The component already receives `osId` as a prop. Add `useRouter` inside the component and render `PendingRequirements` after `ChecklistProgressRow`:

```tsx
export function GeneralTab({ order, osId, /* ...rest */ }: GeneralTabProps): React.JSX.Element {
  const router = useRouter();
  // ... existing code ...

  return (
    <>
      {/* Action buttons - existing */}
      {/* ... */}

      <ChecklistProgressRow /* existing */ />

      {/* NEW: Pending requirements preview */}
      <PendingRequirements
        currentStatus={order.status}
        transitionRequirements={order.transition_requirements}
        onPress={(targetStatus) => {
          router.push({
            pathname: '/(app)/os/resolver/[osId]',
            params: { osId, target: targetStatus },
          });
        }}
      />

      {/* Vistoria CTAs - existing */}
      {/* ... rest of existing code ... */}
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "(PendingRequirements|GeneralTab)"`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/os/PendingRequirements.tsx src/components/os/GeneralTab.tsx
git commit -m "feat(mobile): add PendingRequirements preview card in GeneralTab"
```

---

### Task 7: Final integration test and cleanup

- [ ] **Step 1: Full flow test**

Test the complete flow manually:
1. Open an OS in "Recepcao" status
2. Verify the "Para avancar" card appears in GeneralTab with pending count
3. Tap "Resolver" — should navigate to wizard screen
4. Verify hard blocks show with action buttons
5. Fill in an inline field (e.g., customer_type), tap Save
6. Pull to refresh — verify the item disappears from blocks
7. Navigate to camera/vistoria and return — verify auto-revalidation
8. When all hard blocks resolved, tap "Avancar" — should transition

- [ ] **Step 2: Test edge cases**

1. OS with no pending requirements — "Para avancar" card should NOT appear
2. OS with only soft blocks — should show "Solicitar Liberacao" button
3. OS with pending override — should show banner
4. Terminal statuses (delivered/cancelled) — no "Avancar Status" button at all

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(mobile): wizard de resolucao de pendencias completo"
```
