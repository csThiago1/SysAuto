import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { MonoLabel } from '@/components/ui/MonoLabel';
import { StatusDot } from '@/components/ui/StatusDot';
import { getStatusLabel, getStatusColor, getStatusBackgroundColor } from '@/components/os/OSStatusBadge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import { useUpdateOSStatus } from '@/hooks/useUpdateOSStatus';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { useSignatureCapture } from '@/hooks/useSignatureCapture';
import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore } from '@/stores/photo.store';
import { useChecklistItemsStore } from '@/stores/checklist-items.store';
import { toast } from '@/stores/toast.store';
import { PartsTab } from '@/components/os/PartsTab';
import { LaborTab } from '@/components/os/LaborTab';
import { GeneralTab } from '@/components/os/GeneralTab';
import { PhotosTab } from '@/components/os/PhotosTab';
import { DocsTab } from '@/components/os/DocsTab';
import { HistoryTab } from '@/components/os/HistoryTab';
import { EditOSModal } from '@/components/os/EditOSModal';
import { useOSParts } from '@/hooks/useOSParts';
import { useOSLabor } from '@/hooks/useOSLabor';
import type { ServiceOrderStatus } from '@paddock/types';
import type { OSStatus } from '@/constants/theme';
import { TransitionRequirementsSheet } from '@/components/os/TransitionRequirementsSheet';

import {
  TAB_NAMES,
} from '@/components/os/os-detail-utils';
import type { ServiceOrderDetail } from '@/components/os/os-detail-utils';
import { StatusUpdateModal } from '@/components/os/StatusUpdateModal';
import { OSDetailSkeleton } from '@/components/os/OSDetailSkeleton';

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OSDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [statusModalVisible, setStatusModalVisible] = React.useState<boolean>(false);
  const [requirementsTarget, setRequirementsTarget] = React.useState<ServiceOrderStatus | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const tabOpacity = useRef(new Animated.Value(1)).current;

  const handleTabChange = useCallback((index: number) => {
    Animated.timing(tabOpacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(index);
      Animated.timing(tabOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [tabOpacity]);

  const [refreshing, setRefreshing] = useState<boolean>(false);

  // The hook returns ServiceOrderDetailAPI; we cast to ServiceOrderDetail because
  // the real API endpoint serializes photos/parts/labor_items/transition_logs.
  // The offline model omits them — they will simply be undefined.
  const { order: rawOrder, isLoading, refetch } = useServiceOrder(id ?? '');
  const order = rawOrder as ServiceOrderDetail | null;

  const handleRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // isUpdating is passed to StatusUpdateModal to disable re-selection while a
  // transition is in-flight (via TransitionRequirementsSheet).
  const { isUpdating } = useUpdateOSStatus(id ?? '');

  const signatureCapture = useSignatureCapture();
  const [showDeliverySignature, setShowDeliverySignature] = useState(false);
  const [showEditOS, setShowEditOS] = useState(false);

  const osId = id ?? '';
  const photoCount = usePhotoStore(
    (s) => s.queue.filter((i) => i.osId === osId).length,
  );
  const { ok: itemsOk, attention: itemsAttention, critical: itemsCritical } =
    useChecklistItemsStore(useShallow((s) => s.getSummary(osId, 'entrada')));

  const { data: parts } = useOSParts(id as string);
  const { data: laborItems } = useOSLabor(id as string);

  const partsHookTotal = (parts ?? []).reduce((sum, p) => sum + parseFloat(p.subtotal || '0'), 0);
  const laborHookTotal = (laborItems ?? []).reduce((sum, l) => sum + parseFloat(l.total || '0'), 0);

  const handleBack = useCallback((): void => {
    router.replace('/(app)');
  }, [router]);

  const handleChecklist = useCallback((): void => {
    router.push(`/(app)/checklist/${id ?? ''}`);
  }, [router, id]);

  const handleAddAcompanhamento = useCallback((): void => {
    const queue = usePhotoStore.getState().queue;
    const existing = queue.filter((p) => p.osId === osId && p.folder === 'acompanhamento');
    const nextIndex = existing.length;
    router.push({
      pathname: '/(app)/camera',
      params: {
        osId,
        slot: `acomp_${nextIndex}`,
        folder: 'acompanhamento',
        checklistType: 'acompanhamento',
        returnTo: `/(app)/os/${osId}`,
      },
    });
  }, [router, osId]);

  const handlePhotoPress = useCallback((url: string): void => {
    setPreviewUrl(url);
  }, []);

  const handleClosePreview = useCallback((): void => {
    setPreviewUrl(null);
  }, []);

  const previewImages = useMemo(
    () => (previewUrl ? [{ uri: previewUrl }] : []),
    [previewUrl],
  );

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

  const handleRequirementsSuccess = useCallback((completedTarget?: ServiceOrderStatus): void => {
    // For 'delivered', offer the signature capture as a post-transition step.
    if (completedTarget === 'delivered') {
      setShowDeliverySignature(true);
    }
    setRequirementsTarget(null);
    void refetch();
  }, [refetch]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <OSDetailSkeleton />
      </SafeAreaView>
    );
  }

  // ── Empty / not found state ───────────────────────────────────────────────
  if (order === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.emptyContainer}>
          <Text variant="heading3" color={Colors.textPrimary}>
            OS não encontrada
          </Text>
          <Text variant="bodySmall" color={Colors.textSecondary} style={styles.emptyHint}>
            A OS solicitada não existe ou você não tem permissão para visualizá-la.
          </Text>
          <Button label="Voltar" variant="secondary" onPress={handleBack} style={styles.emptyButton} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const vehicleLine = [order.make, order.model, order.year ? String(order.year) : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* ── Compact Header ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1c1c1e', '#141414']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        {/* Top row: back + OS number */}
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBackBtn} activeOpacity={0.7} hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <MonoLabel variant="accent" size="md">{`OS #${order.number}`}</MonoLabel>
        </View>
        {/* Body row: plate + vehicle + status */}
        <View style={styles.headerBodyRow}>
          <View style={styles.headerPlateBadge}>
            <Text style={styles.headerPlateText}>{order.plate.toUpperCase()}</Text>
          </View>
          <View style={styles.headerVehicleInfo}>
            <Text variant="bodySmall" color={Colors.textSecondary} numberOfLines={1}>
              {vehicleLine}
            </Text>
            <View style={styles.headerStatusRow}>
              <StatusDot status={order.status as OSStatus} size={8} pulse />
              <View style={[styles.headerStatusBadge, { backgroundColor: getStatusBackgroundColor(order.status) }]}>
                <Text variant="caption" style={{ color: getStatusColor(order.status), fontWeight: '600' }}>
                  {getStatusLabel(order.status)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Segmented Control ──────────────────────────────────────────────── */}
      <SegmentedControl
        tabs={TAB_NAMES}
        activeIndex={activeTab}
        onTabChange={handleTabChange}
      />

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <Animated.View style={{ flex: 1, opacity: tabOpacity }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { void handleRefresh(); }}
            tintColor={Colors.brand}
            colors={[Colors.brand]}
          />
        }
      >
        {activeTab === 0 && (
          <GeneralTab
            order={order}
            osId={osId}
            photoCount={photoCount}
            itemsOk={itemsOk}
            itemsAttention={itemsAttention}
            itemsCritical={itemsCritical}
            partsTotal={partsHookTotal}
            laborTotal={laborHookTotal}
            onOpenStatusModal={() => setStatusModalVisible(true)}
            onOpenChecklist={handleChecklist}
            onOpenEditOS={() => setShowEditOS(true)}
          />
        )}
        {activeTab === 1 && <PartsTab osId={id as string} />}
        {activeTab === 2 && <LaborTab osId={id as string} />}
        {activeTab === 3 && (
          <PhotosTab
            order={order}
            osId={osId}
            onAddAcompanhamento={handleAddAcompanhamento}
            onPhotoPress={handlePhotoPress}
          />
        )}
        {activeTab === 4 && <DocsTab osId={osId} />}
        {activeTab === 5 && <HistoryTab logs={order.transition_logs} />}

        <View style={styles.bottomPadding} />
      </ScrollView>
      </Animated.View>

      {/* ── Modal de avanço de status ─────────────────────────────────── */}
      <StatusUpdateModal
        visible={statusModalVisible}
        currentStatus={order.status as ServiceOrderStatus}
        onSelect={handleSelectStatus}
        onClose={() => setStatusModalVisible(false)}
        isUpdating={isUpdating}
      />

      {/* ── Sheet de pré-requisitos de transição ───────────────────────── */}
      {requirementsTarget !== null && (
        <TransitionRequirementsSheet
          visible
          onClose={() => setRequirementsTarget(null)}
          order={order as unknown as import('@paddock/types').ServiceOrder}
          targetStatus={requirementsTarget}
          validation={order.transition_requirements?.[requirementsTarget]}
          onSuccess={() => handleRequirementsSuccess(requirementsTarget ?? undefined)}
          onOpenEditOS={() => {
            setRequirementsTarget(null);
            setShowEditOS(true);
          }}
          onOpenPartsTab={() => {
            setRequirementsTarget(null);
            setActiveTab(1); // Aba "Peças"
          }}
          onOpenSignature={(docType) => {
            setRequirementsTarget(null);
            if (docType === 'OS_DELIVERY') {
              setShowDeliverySignature(true);
            }
          }}
        />
      )}

      {/* ── Modal de assinatura de entrega ─────────────────────────────── */}
      <Modal
        visible={showDeliverySignature}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDeliverySignature(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={{ flex: 1, padding: Spacing.lg, gap: Spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="heading3">Assinatura de Entrega</Text>
              {/* OS já está em 'delivered' neste ponto — apenas fechar */}
              <TouchableOpacity onPress={() => setShowDeliverySignature(false)}>
                <Text variant="body" color={Colors.textTertiary}>Pular</Text>
              </TouchableOpacity>
            </View>
            <Text variant="body" color={Colors.textSecondary}>
              O cliente confirma o recebimento do veículo em boas condições.
            </Text>
            <SignatureCanvas
              height={250}
              signerName={order?.customer_name ?? ''}
              onSave={async (base64) => {
                try {
                  await signatureCapture.mutateAsync({
                    service_order_id: order?.number ?? 0,
                    document_type: 'OS_DELIVERY',
                    signer_name: order?.customer_name ?? '',
                    signature_png_base64: base64,
                  });
                  toast.success('Assinatura de entrega registrada');
                } catch {
                  toast.error('Erro ao registrar assinatura');
                }
                setShowDeliverySignature(false);
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Photo viewer with pinch-to-zoom + landscape ─────────────── */}
      <ImageViewing
        images={previewImages}
        imageIndex={0}
        visible={!!previewUrl}
        onRequestClose={handleClosePreview}
        presentationStyle="overFullScreen"
      />

      {/* Edit OS Modal */}
      {order && (
        <EditOSModal
          visible={showEditOS}
          osId={id as string}
          initialData={{
            customer_type: order.customer_type,
            os_type: order.os_type,
            casualty_number: order.casualty_number,
            deductible_amount: order.deductible_amount,
            estimated_delivery_date: order.estimated_delivery_date,
            observations: order.observations,
          }}
          onClose={() => setShowEditOS(false)}
          onSaved={() => void refetch()}
        />
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  headerPlateBadge: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerPlateText: {
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  headerVehicleInfo: {
    flex: 1,
    gap: 4,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyHint: {
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 8,
    minWidth: 160,
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
  },
  // Bottom spacing
  bottomPadding: {
    height: 32,
  },
});
