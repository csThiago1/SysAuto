import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Colors, Radii, Spacing, Shadow } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { OSDetailHeader } from '@/components/os/OSDetailHeader';
import { getStatusLabel, getStatusColor, getStatusBackgroundColor } from '@/components/os/OSStatusBadge';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import { useUpdateOSStatus } from '@/hooks/useUpdateOSStatus';
import { useShallow } from 'zustand/react/shallow';
import { usePhotoStore, uploadPendingPhotos } from '@/stores/photo.store';
import { useChecklistItemsStore } from '@/stores/checklist-items.store';
import { useConnectivity } from '@/hooks/useConnectivity';
import { VALID_TRANSITIONS } from '@paddock/types';
import type { ServiceOrderStatus } from '@paddock/types';

// ─── Extended detail type (superset of what the hook returns) ─────────────────

interface OSPhoto {
  id: string;
  folder: string;
  url: string;
  caption?: string;
}

interface OSLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: string;
  total: string;
}

interface OSTransitionLog {
  id: string;
  from_status: string;
  to_status: string;
  created_at: string;       // campo real do backend StatusTransitionLog
  changed_by_name?: string; // campo real do backend (get_full_name ou email)
}

// The hook's ServiceOrderDetailAPI is the base; we extend it with the rich
// fields that the real endpoint returns but the offline model doesn't cache.
interface ServiceOrderDetail {
  id: string;
  number: number;
  status: string;
  customer_name: string;
  customer_type: string;
  os_type: string;
  plate: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  opened_at: string;
  parts_total: string;
  services_total: string;
  consultant?: { id: string; email: string; full_name: string };
  photos?: OSPhoto[];
  parts?: OSLineItem[];
  labor_items?: OSLineItem[];
  transition_logs?: OSTransitionLog[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FOLDER_LABELS: Record<string, string> = {
  checklist_entrada: 'Checklist de Entrada',
  acompanhamento: 'Acompanhamento',
  checklist_saida: 'Checklist de Saída',
  pericia: 'Perícia',
  outros: 'Outros',
};

const OS_TYPE_LABELS: Record<string, string> = {
  bodywork:   'Lataria/Pintura',
  warranty:   'Garantia',
  rework:     'Retrabalho',
  mechanical: 'Mecânica',
  aesthetic:  'Estética',
};

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  insurer: 'Seguradora',
  private: 'Particular',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function groupPhotosByFolder(photos: OSPhoto[]): [string, OSPhoto[]][] {
  const grouped = photos.reduce<Record<string, OSPhoto[]>>((acc, photo) => {
    const key = photo.folder;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(photo);
    return acc;
  }, {});
  return Object.entries(grouped);
}

// ─── Status Update Modal ──────────────────────────────────────────────────────

interface StatusUpdateModalProps {
  visible: boolean;
  currentStatus: ServiceOrderStatus;
  onSelect: (status: ServiceOrderStatus) => void;
  onClose: () => void;
  isUpdating: boolean;
}

function StatusUpdateModal({
  visible,
  currentStatus,
  onSelect,
  onClose,
  isUpdating,
}: StatusUpdateModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const nextStatuses = VALID_TRANSITIONS[currentStatus] ?? [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <Text variant="label" color={Colors.textPrimary}>
            Avançar Status
          </Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.modalClose}>
            <Ionicons name="close" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <Text variant="bodySmall" color={Colors.textTertiary} style={styles.modalSubtitle}>
          Status atual: <Text variant="bodySmall" color={Colors.textPrimary}>{getStatusLabel(currentStatus)}</Text>
        </Text>
        {nextStatuses.length === 0 ? (
          <Text variant="bodySmall" color={Colors.textSecondary} style={styles.modalEmpty}>
            Nenhuma transição disponível para este status.
          </Text>
        ) : (
          nextStatuses.map((s) => {
            const color = getStatusColor(s);
            const bg = getStatusBackgroundColor(s);
            return (
              <TouchableOpacity
                key={s}
                activeOpacity={0.75}
                disabled={isUpdating}
                onPress={() => onSelect(s)}
                style={[styles.statusRow, { backgroundColor: bg }]}
              >
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <Text variant="body" style={[styles.statusRowLabel, { color }]}>
                  {getStatusLabel(s)}
                </Text>
                {isUpdating ? (
                  <ActivityIndicator size="small" color={color} />
                ) : (
                  <Ionicons name="arrow-forward" size={16} color={color} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonBlock({ height }: { height: number }): React.JSX.Element {
  return <View style={[styles.skeleton, { height }]} />;
}

function LoadingSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeletonContainer}>
      <SkeletonBlock height={80} />
      <SkeletonBlock height={140} />
      <SkeletonBlock height={100} />
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="label" color={Colors.textSecondary}>
        {title}
      </Text>
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text variant="bodySmall" color={Colors.textTertiary} style={styles.infoLabel}>
        {label}
      </Text>
      <Text variant="bodySmall" color={Colors.textPrimary} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

interface PhotoGroupProps {
  folder: string;
  photos: OSPhoto[];
  onPhotoPress: (url: string) => void;
}

function PhotoGroup({ folder, photos, onPhotoPress }: PhotoGroupProps): React.JSX.Element {
  const label = FOLDER_LABELS[folder] ?? folder;

  return (
    <View style={styles.photoGroup}>
      <Text variant="bodySmall" color={Colors.textSecondary} style={styles.photoGroupTitle}>
        {label}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
        {photos.map((photo) => (
          <TouchableOpacity
            key={photo.id}
            onPress={() => onPhotoPress(photo.url)}
            activeOpacity={0.85}
            style={styles.photoWrapper}
          >
            <Image
              source={{ uri: photo.url }}
              style={styles.photo}
              resizeMode="cover"
            />
            {photo.caption != null && photo.caption.length > 0 && (
              <Text variant="caption" color={Colors.textTertiary} numberOfLines={1} style={styles.photoCaption}>
                {photo.caption}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

interface LineItemRowProps {
  item: OSLineItem;
}

function LineItemRow({ item }: LineItemRowProps): React.JSX.Element {
  return (
    <View style={styles.lineItemRow}>
      <View style={styles.lineItemInfo}>
        <Text variant="bodySmall" color={Colors.textPrimary} numberOfLines={2}>
          {item.description}
        </Text>
        <Text variant="caption" color={Colors.textSecondary}>
          {item.quantity}x {formatCurrency(item.unit_price)}
        </Text>
      </View>
      <Text variant="bodySmall" color={Colors.textSecondary} style={styles.lineItemTotal}>
        {formatCurrency(item.total)}
      </Text>
    </View>
  );
}

interface TransitionLogItemProps {
  log: OSTransitionLog;
}

function TransitionLogItem({ log }: TransitionLogItemProps): React.JSX.Element {
  const fromLabel = getStatusLabel(log.from_status);
  const toLabel = getStatusLabel(log.to_status);

  return (
    <View style={styles.logItem}>
      <View style={styles.logDot} />
      <View style={styles.logContent}>
        <Text variant="bodySmall" color={Colors.textSecondary}>
          {fromLabel} → {toLabel}
        </Text>
        <Text variant="caption" color={Colors.textSecondary}>
          {formatDateTime(log.created_at)}
          {log.changed_by_name != null && log.changed_by_name.length > 0
            ? ` · ${log.changed_by_name}`
            : ''}
        </Text>
      </View>
    </View>
  );
}

// ─── Checklist Progress Row ───────────────────────────────────────────────────

interface ChecklistProgressRowProps {
  photoCount: number;
  ok: number;
  attention: number;
  critical: number;
}

function ChecklistProgressRow({ photoCount, ok, attention, critical }: ChecklistProgressRowProps): React.JSX.Element {
  const hasAny = photoCount > 0 || ok > 0 || attention > 0 || critical > 0;
  if (!hasAny) return <View style={styles.progressRowEmpty} />;

  return (
    <View style={styles.progressRow}>
      {photoCount > 0 && (
        <View style={styles.progressChip}>
          <Ionicons name="camera-outline" size={12} color={Colors.textTertiary} />
          <Text variant="caption" color={Colors.textTertiary}>{photoCount} foto{photoCount !== 1 ? 's' : ''}</Text>
        </View>
      )}
      {ok > 0 && (
        <View style={[styles.progressChip, styles.progressChipOk]}>
          <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
          <Text variant="caption" style={{ color: '#16a34a' }}>{ok} OK</Text>
        </View>
      )}
      {attention > 0 && (
        <View style={[styles.progressChip, styles.progressChipAttention]}>
          <Ionicons name="warning" size={12} color="#d97706" />
          <Text variant="caption" style={{ color: '#d97706' }}>{attention} Atenção</Text>
        </View>
      )}
      {critical > 0 && (
        <View style={[styles.progressChip, styles.progressChipCritical]}>
          <Ionicons name="alert-circle" size={12} color="#dc2626" />
          <Text variant="caption" style={{ color: '#dc2626' }}>{critical} Crítico</Text>
        </View>
      )}
    </View>
  );
}

// ─── Vistoria CTA Card ────────────────────────────────────────────────────────

interface VistoriaCTACardProps {
  type: 'entrada' | 'saida';
  osId: string;
}

function VistoriaCTACard({ type, osId }: VistoriaCTACardProps): React.JSX.Element {
  const router = useRouter();
  const isEntrada = type === 'entrada';
  const bg = isEntrada ? '#eff6ff' : '#f0fdf4';
  const borderColor = isEntrada ? '#bfdbfe' : '#bbf7d0';
  const color = isEntrada ? '#1d4ed8' : '#15803d';
  const icon: React.ComponentProps<typeof Ionicons>['name'] = isEntrada ? 'search-outline' : 'checkmark-done-outline';
  const title = isEntrada ? 'Iniciar Vistoria de Entrada' : 'Iniciar Vistoria de Saída';
  const description = isEntrada
    ? 'Registre o estado do veículo na entrada: fotos e checklist completo.'
    : 'Confirme os reparos realizados com comparativo antes/depois.';

  const handlePress = (): void => {
    const path = isEntrada
      ? `/(app)/vistoria/entrada/${osId}`
      : `/(app)/vistoria/saida/${osId}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(path as any);
  };

  return (
    <TouchableOpacity
      style={[styles.vstCard, { backgroundColor: bg, borderColor }]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      <View style={styles.vstCardIcon}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.vstCardBody}>
        <Text variant="label" style={[styles.vstCardTitle, { color }]}>
          {title}
        </Text>
        <Text variant="bodySmall" color={Colors.textTertiary} style={styles.vstCardDesc}>
          {description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color} />
    </TouchableOpacity>
  );
}

// ─── Acompanhamento Section ───────────────────────────────────────────────────

interface AcompanhamentoSectionProps {
  osId: string;
  onAddPhoto: () => void;
  onPhotoPress: (url: string) => void;
  remotePhotos: OSPhoto[];
}

const AcompanhamentoSection = React.memo(function AcompanhamentoSection({
  osId,
  onAddPhoto,
  onPhotoPress,
  remotePhotos,
}: AcompanhamentoSectionProps): React.JSX.Element {
  const isOnline = useConnectivity();
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const localPhotos = usePhotoStore(
    useShallow((s) => s.queue.filter((p) => p.osId === osId && p.folder === 'acompanhamento')),
  );

  const pendingCount = localPhotos.filter((p) => p.uploadStatus === 'pending').length;
  const showUpload = pendingCount > 0 && isOnline;

  const handleUpload = useCallback((): void => {
    if (isUploading) return;
    setIsUploading(true);
    void uploadPendingPhotos().finally(() => setIsUploading(false));
  }, [isUploading]);

  return (
    <View>
      <View style={styles.acompSectionHeader}>
        <Text variant="label" color={Colors.textSecondary}>
          Fotos de Acompanhamento
        </Text>
        <TouchableOpacity
          style={styles.acompAddBtn}
          onPress={onAddPhoto}
          activeOpacity={0.75}
        >
          <Ionicons name="camera-outline" size={16} color="#e31b1b" />
          <Text variant="caption" style={styles.acompAddLabel}>
            Adicionar
          </Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.card} padded={false}>
        {localPhotos.length === 0 && remotePhotos.length === 0 ? (
          <View style={styles.acompEmpty}>
            <Ionicons name="images-outline" size={32} color="#d1d5db" />
            <Text variant="bodySmall" color={Colors.textSecondary} style={styles.acompEmptyText}>
              Nenhuma foto de acompanhamento ainda
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoScroll}
            contentContainerStyle={styles.acompScrollContent}
          >
            {/* Remote (uploaded) photos */}
            {remotePhotos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                onPress={() => onPhotoPress(photo.url)}
                activeOpacity={0.85}
                style={styles.acompThumb}
              >
                <Image source={{ uri: photo.url }} style={styles.acompThumbImg} resizeMode="cover" />
                <View style={[styles.acompThumbBadge, styles.acompThumbDone]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
            {/* Local (queued) photos */}
            {localPhotos.map((photo) => {
              const uri = photo.annotatedLocalUri ?? photo.localUri;
              const isDone = photo.uploadStatus === 'done';
              const isErr = photo.uploadStatus === 'error';
              return (
                <TouchableOpacity
                  key={photo.id}
                  onPress={() => onPhotoPress(photo.remoteUrl ?? uri)}
                  activeOpacity={0.85}
                  style={styles.acompThumb}
                >
                  <Image source={{ uri }} style={styles.acompThumbImg} resizeMode="cover" />
                  <View
                    style={[
                      styles.acompThumbBadge,
                      isDone ? styles.acompThumbDone : isErr ? styles.acompThumbErr : styles.acompThumbPending,
                    ]}
                  >
                    {photo.uploadStatus === 'uploading' ? (
                      <ActivityIndicator size="small" color="#fff" style={{ width: 10, height: 10 }} />
                    ) : (
                      <Ionicons
                        name={isDone ? 'checkmark' : isErr ? 'alert' : 'time-outline'}
                        size={10}
                        color="#fff"
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {showUpload && (
          <TouchableOpacity
            style={styles.acompUploadBtn}
            onPress={handleUpload}
            activeOpacity={0.8}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
            )}
            <Text variant="caption" style={styles.acompUploadLabel}>
              {isUploading ? 'Enviando...' : `Enviar fotos (${pendingCount})`}
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OSDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [statusModalVisible, setStatusModalVisible] = React.useState<boolean>(false);

  // The hook returns ServiceOrderDetailAPI; we cast to ServiceOrderDetail because
  // the real API endpoint serializes photos/parts/labor_items/transition_logs.
  // The offline model omits them — they will simply be undefined.
  const { order: rawOrder, isLoading } = useServiceOrder(id ?? '');
  const order = rawOrder as ServiceOrderDetail | null;

  const { update: updateStatus, isUpdating } = useUpdateOSStatus(id ?? '');

  const osId = id ?? '';
  const photoCount = usePhotoStore(
    (s) => s.queue.filter((i) => i.osId === osId).length,
  );
  const { ok: itemsOk, attention: itemsAttention, critical: itemsCritical } =
    useChecklistItemsStore(useShallow((s) => s.getSummary(osId, 'entrada')));

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

  const handleSelectStatus = useCallback(async (newStatus: ServiceOrderStatus): Promise<void> => {
    try {
      await updateStatus(newStatus);
      setStatusModalVisible(false);
    } catch {
      // erro exibido via toast ou deixado para futuro refinamento
    }
  }, [updateStatus]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <LoadingSkeleton />
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
  const partsTotal = parseFloat(order.parts_total);
  const servicesTotal = parseFloat(order.services_total);
  const grandTotal = (isNaN(partsTotal) ? 0 : partsTotal) + (isNaN(servicesTotal) ? 0 : servicesTotal);

  const acompanhamentoRemote = (order.photos ?? []).filter((p) => p.folder === 'acompanhamento');
  const nonAcompanhamenntoPhotos = (order.photos ?? []).filter((p) => p.folder !== 'acompanhamento');
  const photoGroups = nonAcompanhamenntoPhotos.length > 0
    ? groupPhotosByFolder(nonAcompanhamenntoPhotos)
    : [];

  const hasParts = order.parts != null && order.parts.length > 0;
  const hasLaborItems = order.labor_items != null && order.labor_items.length > 0;
  const hasItems = hasParts || hasLaborItems;
  const hasHistory = order.transition_logs != null && order.transition_logs.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Cabecalho fixo */}
      <OSDetailHeader
        number={order.number}
        status={order.status}
        plate={order.plate}
        make={order.make}
        model={order.model}
        year={order.year}
        color={order.color}
        onBack={handleBack}
      />

      {/* ── Botões de ação ──────────────────────────────────────────────── */}
      <View style={styles.actionRow}>
        {/* Avançar Status — só aparece se há transições válidas */}
        {(VALID_TRANSITIONS[order.status as ServiceOrderStatus] ?? []).length > 0 && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => setStatusModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#e31b1b" />
            <Text variant="label" color="#e31b1b">
              Avançar Status
            </Text>
          </TouchableOpacity>
        )}

        {/* Checklist Fotográfico */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary, (VALID_TRANSITIONS[order.status as ServiceOrderStatus] ?? []).length > 0 && styles.actionBtnFlex]}
          onPress={handleChecklist}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-outline" size={16} color="#ffffff" />
          <Text variant="label" color="#ffffff">
            Checklist
          </Text>
        </TouchableOpacity>
      </View>
      <ChecklistProgressRow
        photoCount={photoCount}
        ok={itemsOk}
        attention={itemsAttention}
        critical={itemsCritical}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Vistoria CTAs ─────────────────────────────────────────────── */}
        {order.status === 'initial_survey' && (
          <View style={styles.vstCardWrapper}>
            <VistoriaCTACard type="entrada" osId={osId} />
          </View>
        )}
        {order.status === 'final_survey' && (
          <View style={styles.vstCardWrapper}>
            <VistoriaCTACard type="saida" osId={osId} />
          </View>
        )}

        {/* ── Secao 1: Dados Gerais ─────────────────────────────────────── */}
        <SectionHeader title="Dados Gerais" />
        <Card style={styles.card}>
          <InfoRow label="Cliente" value={order.customer_name} />
          <InfoRow
            label="Tipo de cliente"
            value={CUSTOMER_TYPE_LABELS[order.customer_type] ?? order.customer_type}
          />
          <InfoRow
            label="Tipo de OS"
            value={OS_TYPE_LABELS[order.os_type] ?? order.os_type}
          />
          {order.consultant != null && (
            <InfoRow label="Consultor" value={order.consultant.full_name} />
          )}
          <InfoRow label="Abertura" value={formatDateTime(order.opened_at)} />

          <View style={styles.divider} />

          <View style={styles.totalsRow}>
            <View style={styles.totalItem}>
              <Text variant="caption" color={Colors.textTertiary}>
                Peças
              </Text>
              <Text variant="bodySmall" color={Colors.textSecondary}>
                {formatCurrency(order.parts_total)}
              </Text>
            </View>
            <View style={styles.totalItem}>
              <Text variant="caption" color={Colors.textTertiary}>
                Serviços
              </Text>
              <Text variant="bodySmall" color={Colors.textSecondary}>
                {formatCurrency(order.services_total)}
              </Text>
            </View>
            <View style={styles.totalItem}>
              <Text variant="caption" color={Colors.textTertiary}>
                Total
              </Text>
              <Text variant="label" color={Colors.textPrimary} style={styles.grandTotal}>
                {grandTotal.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Secao 2: Fotos de Acompanhamento ─────────────────────────── */}
        <AcompanhamentoSection
          osId={osId}
          onAddPhoto={handleAddAcompanhamento}
          onPhotoPress={handlePhotoPress}
          remotePhotos={acompanhamentoRemote}
        />

        {/* ── Secao 3: Outras Fotos ──────────────────────────────────────── */}
        {photoGroups.length > 0 && (
          <>
            <SectionHeader title="Fotos" />
            <Card style={styles.card} padded={false}>
              {photoGroups.map(([folder, photos]) => (
                <PhotoGroup
                  key={folder}
                  folder={folder}
                  photos={photos}
                  onPhotoPress={handlePhotoPress}
                />
              ))}
            </Card>
          </>
        )}

        {/* ── Secao 4: Peças e Serviços ─────────────────────────────────── */}
        {hasItems && (
          <>
            <SectionHeader title="Peças e Serviços" />
            <Card style={styles.card}>
              {hasParts && (
                <>
                  <Text variant="label" color={Colors.textTertiary} style={styles.subsectionTitle}>
                    Peças
                  </Text>
                  {order.parts!.map((item) => (
                    <LineItemRow key={item.id} item={item} />
                  ))}
                  <View style={styles.subtotalRow}>
                    <Text variant="bodySmall" color={Colors.textTertiary}>
                      Subtotal peças
                    </Text>
                    <Text variant="label" color={Colors.textSecondary}>
                      {formatCurrency(order.parts_total)}
                    </Text>
                  </View>
                </>
              )}

              {hasParts && hasLaborItems && <View style={styles.divider} />}

              {hasLaborItems && (
                <>
                  <Text variant="label" color={Colors.textTertiary} style={styles.subsectionTitle}>
                    Serviços
                  </Text>
                  {order.labor_items!.map((item) => (
                    <LineItemRow key={item.id} item={item} />
                  ))}
                  <View style={styles.subtotalRow}>
                    <Text variant="bodySmall" color={Colors.textTertiary}>
                      Subtotal serviços
                    </Text>
                    <Text variant="label" color={Colors.textSecondary}>
                      {formatCurrency(order.services_total)}
                    </Text>
                  </View>
                </>
              )}
            </Card>
          </>
        )}

        {/* ── Secao 5: Historico ────────────────────────────────────────── */}
        {hasHistory && (
          <>
            <SectionHeader title="Histórico de Status" />
            <Card style={styles.card}>
              {order.transition_logs!.map((log) => (
                <TransitionLogItem key={log.id} log={log} />
              ))}
            </Card>
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* ── Modal de avanço de status ─────────────────────────────────── */}
      <StatusUpdateModal
        visible={statusModalVisible}
        currentStatus={order.status as ServiceOrderStatus}
        onSelect={handleSelectStatus}
        onClose={() => setStatusModalVisible(false)}
        isUpdating={isUpdating}
      />

      {/* ── Modal de preview de foto ───────────────────────────────────── */}
      <Modal
        visible={previewUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={handleClosePreview}
      >
        <TouchableOpacity
          style={styles.previewBackdrop}
          onPress={handleClosePreview}
          activeOpacity={1}
        >
          {previewUrl !== null && (
            <Image
              source={{ uri: previewUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  // Skeleton
  skeletonContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  skeleton: {
    backgroundColor: Colors.skeleton,
    borderRadius: Radii.md,
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
    paddingTop: 8,
  },
  // Section header
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  // Card
  card: {
    marginHorizontal: 16,
    gap: 10,
  },
  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoLabel: {
    flex: 1,
  },
  infoValue: {
    flex: 2,
    textAlign: 'right',
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: 4,
  },
  // Totals
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalItem: {
    alignItems: 'center',
    gap: 2,
  },
  grandTotal: {
    fontWeight: '700',
  },
  // Photo groups
  photoGroup: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  photoGroupTitle: {
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  photoScroll: {
    paddingLeft: 16,
  },
  photoWrapper: {
    marginRight: 10,
    alignItems: 'center',
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: Radii.sm,
    backgroundColor: Colors.skeleton,
  },
  photoCaption: {
    marginTop: 4,
    maxWidth: 120,
  },
  // Line items
  subsectionTitle: {
    marginBottom: 4,
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  lineItemInfo: {
    flex: 1,
    gap: 2,
  },
  lineItemTotal: {
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'right',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    marginTop: 4,
  },
  // Transition log
  logItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e31b1b',
    marginTop: 6,
  },
  logContent: {
    flex: 1,
    gap: 2,
  },
  // Action row
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.brand,
    flex: 1,
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: Colors.brandTint,
    borderWidth: 1,
    borderColor: Colors.brand,
  },
  actionBtnFlex: {
    flex: 1,
  },

  // Status update modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlayLight,
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalClose: {
    padding: 4,
  },
  modalSubtitle: {
    marginBottom: 12,
  },
  modalEmpty: {
    textAlign: 'center',
    paddingVertical: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  // Checklist progress row
  progressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  progressRowEmpty: {
    height: 8,
  },
  progressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.borderSubtle,
    borderRadius: 20,
  },
  progressChipOk: {
    backgroundColor: '#dcfce7',
  },
  progressChipAttention: {
    backgroundColor: '#fef3c7',
  },
  progressChipCritical: {
    backgroundColor: '#fee2e2',
  },
  // Vistoria CTA card
  vstCardWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  vstCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  vstCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vstCardBody: {
    flex: 1,
    gap: 2,
  },
  vstCardTitle: {
    fontWeight: '700',
  },
  vstCardDesc: {
    lineHeight: 18,
  },

  // Acompanhamento section
  acompSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  acompAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.brandTint,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.brand,
  },
  acompAddLabel: {
    color: Colors.brand,
  },
  acompEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  acompEmptyText: {
    textAlign: 'center',
  },
  acompScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  acompThumb: {
    width: 90,
    height: 90,
    borderRadius: Radii.sm,
    overflow: 'hidden',
    marginRight: 8,
    position: 'relative',
  },
  acompThumbImg: {
    width: '100%',
    height: '100%',
  },
  acompThumbBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acompThumbDone: { backgroundColor: '#16a34a' },
  acompThumbErr: { backgroundColor: '#ef4444' },
  acompThumbPending: { backgroundColor: Colors.textSecondary },
  acompUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.brand,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radii.sm,
  },
  acompUploadLabel: {
    color: Colors.textPrimary,
  },

  // Bottom spacing
  bottomPadding: {
    height: 32,
  },
  // Photo preview modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center', // sem token — overlay muito escuro específico para preview de foto
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
});
