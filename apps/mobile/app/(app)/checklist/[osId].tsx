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
import { Colors, Radii, Spacing, Typography } from '@/constants/theme';

import { Text } from '@/components/ui/Text';
import { PhotoSlotGrid } from '@/components/checklist/PhotoSlotGrid';
import { ItemChecklistGrid } from '@/components/checklist/ItemChecklistGrid';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import { usePhotoStore, uploadPendingPhotos } from '@/stores/photo.store';
import { useShallow } from 'zustand/react/shallow';
import { useChecklistItemsStore, syncChecklistItems } from '@/stores/checklist-items.store';
import { useConnectivity } from '@/hooks/useConnectivity';
import {
  getStatusLabel,
  getStatusColor,
  getStatusBackgroundColor,
} from '@/components/os/OSStatusBadge';

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

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  const label = getStatusLabel(status);
  const bg = getStatusBackgroundColor(status);
  const color = getStatusColor(status);

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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Sticky header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
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
              key={tab.label}
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
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color={Colors.textPrimary} />
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
    color: Colors.textPrimary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 64,
    alignItems: 'flex-end',
  },

  // Status badge
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.full,
  },
  badgeText: {
    fontWeight: '600',
  },

  // Tab bar
  tabBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    maxHeight: 48,
  },
  tabBarContent: {
    paddingHorizontal: Spacing.sm,
  },
  tab: {
    paddingHorizontal: Spacing.lg,
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
    ...Typography.labelMono,
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
    paddingBottom: Spacing.xl,
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
    gap: Spacing.sm,
    backgroundColor: Colors.brand,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radii.full,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: Colors.brand,
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
    color: Colors.textPrimary,
  },
});
