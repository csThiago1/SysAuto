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

type DocumentType =
  | 'BUDGET_APPROVAL'
  | 'OS_OPEN'
  | 'OS_DELIVERY'
  | 'COMPLEMENT_APPROVAL'
  | 'INSURANCE_ACCEPTANCE'
  | 'VISTORIA_ENTRADA';

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
  const { osId, target: targetParam } = useLocalSearchParams<{ osId: string; target: string }>();
  const target = (targetParam ?? '') as ServiceOrderStatus;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { order: rawOrder, isLoading, refetch } = useServiceOrder(osId ?? '');
  const order = rawOrder as ServiceOrderDetail | null;
  const validation: TransitionValidationResult | undefined = order?.transition_requirements?.[target];

  const transitionMutation = useTransitionWithValidation(osId ?? '');
  const overrideMutation = useRequestOverride(osId ?? '');
  const signatureCapture = useSignatureCapture();
  const [showSignature, setShowSignature] = useState(false);
  const [signatureDocType, setSignatureDocType] = useState<DocumentType>('OS_DELIVERY');
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

  const renderBlock = (block: ValidationBlock, type: 'hard' | 'soft' | 'warn'): React.JSX.Element => {
    const inlineConfig = INLINE_FIELDS[block.code];
    const navAction = NAV_ACTIONS[block.code];
    const isSignature = SIGNATURE_CODES.includes(block.code);

    if (inlineConfig) {
      return (
        <View key={block.code}>
          <ResolutionItem block={block} type={type} resolved={false} />
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
        resolved={false}
        onAction={
          navAction
            ? () => router.push(navAction.route(osId ?? '') as any)
            : isSignature
              ? () => { setSignatureDocType(block.code === 'CLIENT_SIGNATURE' ? 'OS_DELIVERY' : 'BUDGET_APPROVAL'); setShowSignature(true); }  // both are valid DocumentType values
              : undefined
        }
        actionLabel={navAction?.label ?? (isSignature ? 'Assinar' : undefined)}
        actionIcon={navAction?.icon ?? (isSignature ? 'create' : undefined)}
      />
    );
  };

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Resolver Pendencias</Text>
          <Text style={styles.headerSub}>OS #{order.number} → {targetLabel}</Text>
        </View>
      </View>

      {/* Checklist */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { void handleRefresh(); }} tintColor={Colors.brand} />
        }
      >
        {hasHardBlocks && (
          <>
            <Text style={styles.sectionLabel}>OBRIGATORIO</Text>
            {hardBlocks.map((b) => renderBlock(b, 'hard'))}
          </>
        )}

        {hasSoftBlocks && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>REQUER APROVACAO</Text>
            {softBlocks.map((b) => renderBlock(b, 'soft'))}
          </>
        )}

        {warnings.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>RECOMENDADO</Text>
            {warnings.map((b) => renderBlock(b, 'warn'))}
          </>
        )}

        {canProceed && !hasHardBlocks && !hasSoftBlocks && (
          <View style={styles.allClear}>
            <Ionicons name="checkmark-circle" size={32} color={SemanticColors.success.color} />
            <Text style={styles.allClearText}>Todos os requisitos atendidos!</Text>
          </View>
        )}

        {hasPendingOverride && (
          <View style={styles.pendingBanner}>
            <ActivityIndicator size="small" color={SemanticColors.info.color} />
            <Text style={styles.pendingText}>Liberacao pendente — aguardando gerente</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
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

      {/* Signature modal */}
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
