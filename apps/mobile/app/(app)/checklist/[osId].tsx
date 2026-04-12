import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/Text';
import { PhotoSlotGrid } from '@/components/checklist/PhotoSlotGrid';
import { ItemChecklistGrid } from '@/components/checklist/ItemChecklistGrid';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import { usePhotoStore, uploadPendingPhotos } from '@/stores/photo.store';
import { useShallow } from 'zustand/react/shallow';
import { useChecklistItemsStore, syncChecklistItems } from '@/stores/checklist-items.store';
import { useConnectivity } from '@/hooks/useConnectivity';

// ─── Tab definitions ──────────────────────────────────────────────────────────

interface TabDef {
  label: string;
  folder: string;
  checklistType: string;
  isItems?: boolean;
}

const TABS: TabDef[] = [
  { label: 'Entrada',        folder: 'checklist_entrada', checklistType: 'entrada' },
  { label: 'Acompanhamento', folder: 'acompanhamento',    checklistType: 'acompanhamento' },
  { label: 'Saída',          folder: 'checklist_saida',   checklistType: 'saida' },
  { label: 'Itens',          folder: '',                  checklistType: 'entrada', isItems: true },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  reception:        'Recepção',
  initial_survey:   'Vistoria Inicial',
  budget:           'Orçamento',
  waiting_approval: 'Ag. Aprovação',
  approved:         'Aprovado',
  in_progress:      'Em Progresso',
  waiting_parts:    'Ag. Peças',
  final_survey:     'Vistoria Final',
  ready:            'Pronto',
  delivered:        'Entregue',
  cancelled:        'Cancelado',
};

const STATUS_BG: Record<string, string> = {
  reception:        '#dbeafe',
  initial_survey:   '#dbeafe',
  budget:           '#fef9c3',
  waiting_approval: '#fef9c3',
  approved:         '#dcfce7',
  in_progress:      '#dcfce7',
  waiting_parts:    '#fef9c3',
  final_survey:     '#dbeafe',
  ready:            '#dcfce7',
  delivered:        '#f3f4f6',
  cancelled:        '#fee2e2',
};

const STATUS_TEXT_COLOR: Record<string, string> = {
  reception:        '#1d4ed8',
  initial_survey:   '#1d4ed8',
  budget:           '#854d0e',
  waiting_approval: '#854d0e',
  approved:         '#166534',
  in_progress:      '#166534',
  waiting_parts:    '#854d0e',
  final_survey:     '#1d4ed8',
  ready:            '#166534',
  delivered:        '#6b7280',
  cancelled:        '#b91c1c',
};

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  const label = STATUS_LABEL[status] ?? status;
  const bg = STATUS_BG[status] ?? '#f3f4f6';
  const color = STATUS_TEXT_COLOR[status] ?? '#374151';

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text variant="caption" style={[styles.badgeText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChecklistDetailScreen(): React.ReactElement {
  const { osId } = useLocalSearchParams<{ osId: string }>();
  const router = useRouter();

  const { order, isLoading } = useServiceOrder(osId);
  const isOnline = useConnectivity();
  const pendingPhotoCount = usePhotoStore((s) => s.queue.filter((i) => i.uploadStatus === 'pending').length);
  const checklistSummary = useChecklistItemsStore(useShallow((s) => s.getSummary(osId, 'entrada')));
  const pendingItemCount = checklistSummary.ok + checklistSummary.attention + checklistSummary.critical;

  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const activeTab = TABS[activeTabIndex];
  const pendingCount = pendingPhotoCount;

  const handleBack = useCallback((): void => {
    router.replace(`/(app)/os/${osId}`);
  }, [router, osId]);

  const handleSlotPress = useCallback(
    (slot: string, folder: string, checklistType: string): void => {
      router.push({
        pathname: '/(app)/camera',
        params: { osId, slot, folder, checklistType },
      });
    },
    [router, osId],
  );

  const handlePhotoPress = useCallback(
    (photoId: string): void => {
      router.push({
        pathname: '/(app)/photo-editor',
        params: { photoId, osId },
      });
    },
    [router, osId],
  );

  const handleUpload = useCallback((): void => {
    if (isUploading) return;
    setIsUploading(true);
    void Promise.all([
      uploadPendingPhotos(),
      pendingItemCount > 0 ? syncChecklistItems(osId) : Promise.resolve(),
    ]).finally(() => {
      setIsUploading(false);
    });
  }, [isUploading, osId, pendingItemCount]);

  // ── Header content ──────────────────────────────────────────────────────────

  const headerTitle = order != null
    ? `OS #${order.number} · ${order.plate}`
    : isLoading
      ? 'Carregando...'
      : `OS ${osId}`;

  const headerSubtitle = order != null
    ? `${order.make} ${order.model}`
    : null;

  const showUploadButton = (pendingCount > 0 || pendingItemCount > 0) && isOnline;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Sticky header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color="#141414" />
          <Text variant="label" style={styles.backLabel}>
            {order != null ? `OS #${order.number}` : 'OS'}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#e31b1b" />
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

        <View style={styles.headerRight}>
          {order != null && <StatusBadge status={order.status} />}
        </View>
      </View>

      {/* ── Tab bar ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab, index) => {
          const isActive = index === activeTabIndex;
          return (
            <TouchableOpacity
              key={tab.checklistType}
              style={styles.tab}
              onPress={() => setActiveTabIndex(index)}
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
      </ScrollView>

      {/* ── Content scroll ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          showUploadButton && styles.scrollContentWithButton,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab.isItems === true ? (
          <ItemChecklistGrid osId={osId} checklistType={activeTab.checklistType} />
        ) : (
          <PhotoSlotGrid
            osId={osId}
            folder={activeTab.folder}
            checklistType={activeTab.checklistType}
            onSlotPress={handleSlotPress}
            onPhotoPress={handlePhotoPress}
          />
        )}
      </ScrollView>

      {/* ── Floating upload button ── */}
      {showUploadButton && (
        <View style={styles.floatingContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={handleUpload}
            activeOpacity={0.85}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" />
            )}
            <Text variant="label" style={styles.floatingLabel}>
              {isUploading
                ? 'Enviando...'
                : pendingCount > 0 && pendingItemCount > 0
                  ? `Enviar fotos e itens`
                  : pendingCount > 0
                    ? `Enviar fotos (${pendingCount})`
                    : `Enviar itens (${pendingItemCount})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 64,
  },
  backLabel: {
    color: '#141414',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    color: '#141414',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#6b7280',
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 64,
    alignItems: 'flex-end',
  },

  // Status badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontWeight: '600',
  },

  // Tab bar
  tabBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    maxHeight: 48,
  },
  tabBarContent: {
    paddingHorizontal: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
    minHeight: 48,
    justifyContent: 'center',
  },
  tabLabel: {
    color: '#6b7280',
    fontWeight: '400',
  },
  tabLabelActive: {
    color: '#e31b1b',
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2.5,
    backgroundColor: '#e31b1b',
    borderRadius: 2,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  scrollContentWithButton: {
    paddingBottom: 112,
  },

  // Floating upload button
  floatingContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e31b1b',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#e31b1b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  floatingLabel: {
    color: '#ffffff',
  },
});
