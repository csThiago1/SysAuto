import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Radii, Spacing, SemanticColors } from '@/constants/theme';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { Text } from '@/components/ui/Text';
import { PhotoSlotGrid } from '@/components/checklist/PhotoSlotGrid';
import { ItemChecklistGrid } from '@/components/checklist/ItemChecklistGrid';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import { useUpdateOSStatus } from '@/hooks/useUpdateOSStatus';
import { usePhotoStore, uploadPendingPhotos } from '@/stores/photo.store';
import { useChecklistItemsStore, syncChecklistItems } from '@/stores/checklist-items.store';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useShallow } from 'zustand/react/shallow';
import { VALID_TRANSITIONS } from '@paddock/types';
import type { ServiceOrderStatus } from '@paddock/types';
import {
  getStatusLabel,
  getStatusColor,
  getStatusBackgroundColor,
} from '@/components/os/OSStatusBadge';

// ─── Tab definitions ──────────────────────────────────────────────────────────

interface TabDef {
  key: string;
  label: string;
}

const TABS: TabDef[] = [
  { key: 'fotos',    label: 'Fotos' },
  { key: 'itens',    label: 'Itens' },
  { key: 'obs',      label: 'Observações' },
];

const FOLDER = 'vistoria_inicial';
const CHECKLIST_TYPE = 'vistoria_inicial';

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VistoriaEntradaScreen(): React.JSX.Element {
  const { osId } = useLocalSearchParams<{ osId: string }>();
  const router = useRouter();
  const isOnline = useConnectivity();

  const { order, isLoading } = useServiceOrder(osId ?? '');
  const { update: updateStatus, isUpdating } = useUpdateOSStatus(osId ?? '');

  const [activeTab, setActiveTab] = useState<string>('fotos');
  const [observacoes, setObservacoes] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const pendingPhotoCount = usePhotoStore(
    (s) => s.queue.filter((p) => p.osId === (osId ?? '') && p.folder === FOLDER && p.uploadStatus === 'pending').length,
  );

  const checklistSummary = useChecklistItemsStore(
    useShallow((s) => s.getSummary(osId ?? '', CHECKLIST_TYPE)),
  );
  const pendingItemCount = checklistSummary.ok + checklistSummary.attention + checklistSummary.critical;

  const currentStatus = order?.status as ServiceOrderStatus | undefined;
  const nextStatuses = currentStatus != null ? (VALID_TRANSITIONS[currentStatus] ?? []) : [];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleBack = useCallback((): void => {
    router.replace(`/(app)/os/${osId ?? ''}`);
  }, [router, osId]);

  const handleSlotPress = useCallback(
    (slot: string, folder: string, checklistType: string): void => {
      router.push({
        pathname: '/(app)/camera',
        params: {
          osId: osId ?? '',
          slot,
          folder,
          checklistType,
          returnTo: `/(app)/vistoria/entrada/${osId ?? ''}`,
        },
      });
    },
    [router, osId],
  );

  const handlePhotoPress = useCallback(
    (photoId: string): void => {
      router.push({
        pathname: '/(app)/photo-editor',
        params: { photoId, osId: osId ?? '' },
      });
    },
    [router, osId],
  );

  const handleUpload = useCallback((): void => {
    if (isUploading) return;
    setIsUploading(true);
    void Promise.all([
      uploadPendingPhotos(),
      pendingItemCount > 0 ? syncChecklistItems(osId ?? '') : Promise.resolve(),
    ]).finally(() => setIsUploading(false));
  }, [isUploading, osId, pendingItemCount]);

  const handleConcluir = useCallback(async (): Promise<void> => {
    if (nextStatuses.length === 0) return;
    // Preferir 'budget' se disponível, caso contrário usar a primeira transição válida
    const targetStatus = (nextStatuses.includes('budget' as ServiceOrderStatus)
      ? 'budget'
      : nextStatuses[0]) as ServiceOrderStatus;
    try {
      await updateStatus(targetStatus);
      router.replace(`/(app)/os/${osId ?? ''}`);
    } catch {
      // erro tratado pelo hook
    }
  }, [nextStatuses, updateStatus, router, osId]);

  // ── Computed ─────────────────────────────────────────────────────────────

  const showUpload = (pendingPhotoCount > 0 || pendingItemCount > 0) && isOnline;

  const headerTitle = order != null
    ? `OS #${order.number} · ${order.plate}`
    : isLoading ? 'Carregando...' : `OS ${osId ?? ''}`;

  const headerSubtitle = order != null ? `${order.make} ${order.model}` : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.bg} />
          <Text variant="label" style={styles.backLabel}>
            {order != null ? `OS #${order.number}` : 'OS'}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.brand} />
          ) : (
            <>
              <Text variant="label" style={styles.headerTitle} numberOfLines={1}>
                {headerTitle}
              </Text>
              {headerSubtitle != null && (
                <Text variant="caption" style={styles.headerSubtitle} numberOfLines={1}>
                  {headerSubtitle}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Vistoria badge */}
        <View style={styles.vistoriaBadge}>
          <Text variant="caption" style={styles.vistoriaBadgeText}>
            Entrada
          </Text>
        </View>
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                variant="label"
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          showUpload && styles.scrollContentWithButton,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'fotos' && (
          <PhotoSlotGrid
            osId={osId ?? ''}
            folder={FOLDER}
            checklistType={CHECKLIST_TYPE}
            onSlotPress={handleSlotPress}
            onPhotoPress={handlePhotoPress}
          />
        )}

        {activeTab === 'itens' && (
          <ItemChecklistGrid osId={osId ?? ''} checklistType={CHECKLIST_TYPE} />
        )}

        {activeTab === 'obs' && (
          <View style={styles.obsContainer}>
            <SectionDivider label="OBSERVAÇÕES" />
            <Text variant="label" color={Colors.textSecondary} style={styles.obsLabel}>
              Observações Gerais da Vistoria
            </Text>
            <TextInput
              style={styles.obsInput}
              value={observacoes}
              onChangeText={setObservacoes}
              placeholder="Descreva o estado geral do veículo, avarias preexistentes, itens de atenção..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>
        )}
      </ScrollView>

      {/* ── Floating upload button ── */}
      {showUpload && (
        <View style={styles.floatingContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={handleUpload}
            activeOpacity={0.85}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color={Colors.textPrimary} />
            )}
            <Text variant="label" style={styles.floatingLabel}>
              {isUploading ? 'Enviando...' : `Enviar (${pendingPhotoCount + pendingItemCount})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Footer: Concluir Vistoria ── */}
      <View style={styles.footer}>
        {nextStatuses.length > 0 ? (
          <>
            <Text variant="caption" color={Colors.textTertiary} style={styles.footerHint}>
              Próximo status sugerido:{' '}
              <Text variant="caption" style={{ color: getStatusColor(nextStatuses[0] as ServiceOrderStatus) }}>
                {getStatusLabel(nextStatuses[0] as ServiceOrderStatus)}
              </Text>
            </Text>
            <TouchableOpacity
              style={[styles.concluirBtn, isUpdating && styles.concluirBtnDisabled]}
              onPress={handleConcluir}
              activeOpacity={0.85}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={Colors.textPrimary} />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.textPrimary} />
              )}
              <Text variant="label" style={styles.concluirLabel}>
                Concluir Vistoria
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.concluirBtn, styles.concluirBtnDisabled]}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textPrimary} />
            <Text variant="label" style={styles.concluirLabel}>
              Nenhuma transição disponível
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 64,
  },
  backLabel: {
    color: Colors.bg,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    color: Colors.bg,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  vistoriaBadge: {
    backgroundColor: SemanticColors.info.bg,
    borderWidth: 1,
    borderColor: SemanticColors.info.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    minWidth: 64,
    alignItems: 'center',
  },
  vistoriaBadgeText: {
    color: SemanticColors.info.color,
    fontWeight: '700',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    position: 'relative',
    minHeight: 48,
    justifyContent: 'center',
  },
  tabLabel: {
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  tabLabelActive: {
    color: Colors.brand,
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.lg,
    right: Spacing.lg,
    height: 2.5,
    backgroundColor: Colors.brand,
    borderRadius: 2,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 24,
  },
  scrollContentWithButton: {
    paddingBottom: 112,
  },

  // Observations
  obsContainer: {
    gap: 10,
  },
  obsLabel: {
    marginBottom: 4,
  },
  obsInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 160,
    textAlignVertical: 'top',
  },

  // Floating upload button
  floatingContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textSecondary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  floatingLabel: {
    color: Colors.textPrimary,
  },

  // Footer
  footer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  footerHint: {
    textAlign: 'center',
  },
  concluirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.brand,
    paddingVertical: 14,
    borderRadius: Radii.md,
  },
  concluirBtnDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  concluirLabel: {
    color: Colors.textPrimary,
  },
});
