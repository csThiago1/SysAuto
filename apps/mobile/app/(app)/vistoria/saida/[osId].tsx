import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

import { Text } from '@/components/ui/Text';
import { useServiceOrder } from '@/hooks/useServiceOrders';
import { useUpdateOSStatus } from '@/hooks/useUpdateOSStatus';
import { usePhotoStore, uploadPendingPhotos } from '@/stores/photo.store';
import type { PhotoQueueItem } from '@/stores/photo.store';
import { useConnectivity } from '@/hooks/useConnectivity';
import { VALID_TRANSITIONS } from '@paddock/types';
import type { ServiceOrderStatus } from '@paddock/types';
import { getStatusLabel, getStatusColor } from '@/components/os/OSStatusBadge';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemotePhoto {
  id: string;
  url: string;
  slot?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BEFORE_FOLDER = 'vistoria_inicial';
const AFTER_FOLDER = 'vistoria_final';
const CHECKLIST_TYPE = 'vistoria_final';

// Slots for the final inspection (mirrors vistoria_inicial external + detail slots)
const FINAL_SLOTS = [
  { key: 'frente',       label: 'Frente' },
  { key: 'traseira',     label: 'Traseira' },
  { key: 'lateral_esq', label: 'Lateral Esq.' },
  { key: 'lateral_dir', label: 'Lateral Dir.' },
  { key: 'diag_diant',  label: 'Diag. Diant.' },
  { key: 'diag_tras',   label: 'Diag. Tras.' },
];

// Repair confirmation items
interface RepairItem {
  key: string;
  label: string;
}

const REPAIR_ITEMS: RepairItem[] = [
  { key: 'lataria_ok',     label: 'Lataria/Funilaria concluída' },
  { key: 'pintura_ok',     label: 'Pintura concluída e uniforme' },
  { key: 'polimento_ok',   label: 'Polimento realizado' },
  { key: 'vidros_ok',      label: 'Vidros íntegros' },
  { key: 'mecanico_ok',    label: 'Serviços mecânicos concluídos' },
  { key: 'limpeza_ok',     label: 'Veículo limpo e entregável' },
];

// ─── Repair Checklist ─────────────────────────────────────────────────────────

interface RepairChecklistProps {
  checkedItems: Set<string>;
  onToggle: (key: string) => void;
}

const RepairChecklist = React.memo(function RepairChecklist({
  checkedItems,
  onToggle,
}: RepairChecklistProps): React.JSX.Element {
  return (
    <View style={styles.repairList}>
      {REPAIR_ITEMS.map((item) => {
        const checked = checkedItems.has(item.key);
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.repairRow}
            onPress={() => onToggle(item.key)}
            activeOpacity={0.75}
          >
            <View style={[styles.repairCheckbox, checked && styles.repairCheckboxChecked]}>
              {checked && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </View>
            <Text
              variant="bodySmall"
              style={[styles.repairLabel, checked && styles.repairLabelChecked]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ─── Comparativo slot ─────────────────────────────────────────────────────────

interface ComparativeSlotProps {
  slotKey: string;
  label: string;
  beforePhoto: RemotePhoto | undefined;
  afterPhoto: PhotoQueueItem | undefined;
  onAddAfter: (slotKey: string) => void;
}

const ComparativeSlot = React.memo(function ComparativeSlot({
  slotKey,
  label,
  beforePhoto,
  afterPhoto,
  onAddAfter,
}: ComparativeSlotProps): React.JSX.Element {
  const afterUri = afterPhoto?.annotatedLocalUri ?? afterPhoto?.remoteUrl ?? afterPhoto?.localUri;

  return (
    <View style={styles.compSlot}>
      <Text variant="caption" color="#374151" style={styles.compSlotLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.compRow}>
        {/* Before */}
        <View style={styles.compHalf}>
          <Text variant="caption" color="#6b7280" style={styles.compHalfLabel}>
            Antes
          </Text>
          {beforePhoto != null ? (
            <Image
              source={{ uri: beforePhoto.url }}
              style={styles.compImg}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.compImg, styles.compImgEmpty]}>
              <Ionicons name="image-outline" size={20} color="#d1d5db" />
            </View>
          )}
        </View>

        <Ionicons name="swap-horizontal" size={18} color="#9ca3af" style={styles.compArrow} />

        {/* After */}
        <View style={styles.compHalf}>
          <Text variant="caption" color="#6b7280" style={styles.compHalfLabel}>
            Depois
          </Text>
          {afterUri != null ? (
            <TouchableOpacity
              onPress={() => onAddAfter(slotKey)}
              activeOpacity={0.85}
              style={styles.compImgTouch}
            >
              <Image source={{ uri: afterUri }} style={styles.compImg} resizeMode="cover" />
              {afterPhoto != null && afterPhoto.uploadStatus === 'pending' && (
                <View style={styles.compPendingBadge}>
                  <Ionicons name="time-outline" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.compImg, styles.compImgEmpty, styles.compImgAdd]}
              onPress={() => onAddAfter(slotKey)}
              activeOpacity={0.75}
            >
              <Ionicons name="camera-outline" size={20} color="#e31b1b" />
              <Text variant="caption" style={styles.compAddLabel}>
                Fotografar
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VistoriaSaidaScreen(): React.JSX.Element {
  const { osId } = useLocalSearchParams<{ osId: string }>();
  const router = useRouter();
  const isOnline = useConnectivity();

  const { order, isLoading } = useServiceOrder(osId ?? '');
  const { update: updateStatus, isUpdating } = useUpdateOSStatus(osId ?? '');

  const [activeTab, setActiveTab] = useState<string>('comparativo');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [observacoes, setObservacoes] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [beforePhotos, setBeforePhotos] = useState<RemotePhoto[]>([]);
  const [beforeLoaded, setBeforeLoaded] = useState<boolean>(false);

  const currentStatus = order?.status as ServiceOrderStatus | undefined;
  const nextStatuses = currentStatus != null ? (VALID_TRANSITIONS[currentStatus] ?? []) : [];

  // Load before photos from API (vistoria_inicial folder)
  React.useEffect(() => {
    if (osId == null || beforeLoaded) return;
    void api.get<{ results?: RemotePhoto[] } | RemotePhoto[]>(
      `/service-orders/${osId}/photos/?folder=${BEFORE_FOLDER}`,
    ).then((data) => {
      const photos = Array.isArray(data) ? data : (data.results ?? []);
      setBeforePhotos(photos);
      setBeforeLoaded(true);
    }).catch(() => {
      setBeforeLoaded(true);
    });
  }, [osId, beforeLoaded]);

  // After photos (local queue)
  const afterPhotos = usePhotoStore((s) =>
    s.queue.filter((p) => p.osId === (osId ?? '') && p.folder === AFTER_FOLDER),
  );

  const pendingCount = afterPhotos.filter((p) => p.uploadStatus === 'pending').length;
  const showUpload = pendingCount > 0 && isOnline;

  // Map before photos by slot
  const beforeBySlot = useMemo<Map<string, RemotePhoto>>(() => {
    const map = new Map<string, RemotePhoto>();
    for (const p of beforePhotos) {
      if (p.slot != null && p.slot.length > 0) map.set(p.slot, p);
    }
    // Fallback: assign by order if slots not present
    if (map.size === 0 && beforePhotos.length > 0) {
      FINAL_SLOTS.forEach((slot, idx) => {
        if (beforePhotos[idx] != null) map.set(slot.key, beforePhotos[idx]);
      });
    }
    return map;
  }, [beforePhotos]);

  // Map after photos by slot
  const afterBySlot = useMemo<Map<string, PhotoQueueItem>>(() => {
    const map = new Map<string, PhotoQueueItem>();
    for (const p of afterPhotos) {
      const existing = map.get(p.slot);
      if (existing === undefined || p.createdAt > existing.createdAt) {
        map.set(p.slot, p);
      }
    }
    return map;
  }, [afterPhotos]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleBack = useCallback((): void => {
    router.replace(`/(app)/os/${osId ?? ''}`);
  }, [router, osId]);

  const handleAddAfter = useCallback(
    (slotKey: string): void => {
      router.push({
        pathname: '/(app)/camera',
        params: {
          osId: osId ?? '',
          slot: slotKey,
          folder: AFTER_FOLDER,
          checklistType: CHECKLIST_TYPE,
          returnTo: `/(app)/vistoria/saida/${osId ?? ''}`,
        },
      });
    },
    [router, osId],
  );

  const handleToggleRepair = useCallback((key: string): void => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }, []);

  const handleUpload = useCallback((): void => {
    if (isUploading) return;
    setIsUploading(true);
    void uploadPendingPhotos().finally(() => setIsUploading(false));
  }, [isUploading]);

  const handleConcluir = useCallback(async (): Promise<void> => {
    if (nextStatuses.length === 0) return;
    const targetStatus = (nextStatuses.includes('ready' as ServiceOrderStatus)
      ? 'ready'
      : nextStatuses[0]) as ServiceOrderStatus;
    try {
      await updateStatus(targetStatus);
      router.replace(`/(app)/os/${osId ?? ''}`);
    } catch {
      // erro tratado pelo hook
    }
  }, [nextStatuses, updateStatus, router, osId]);

  // ── Computed ──────────────────────────────────────────────────────────────

  const headerTitle = order != null
    ? `OS #${order.number} · ${order.plate}`
    : isLoading ? 'Carregando...' : `OS ${osId ?? ''}`;

  const headerSubtitle = order != null ? `${order.make} ${order.model}` : null;

  const TABS = [
    { key: 'comparativo', label: 'Comparativo' },
    { key: 'reparos',     label: 'Confirmação' },
    { key: 'obs',         label: 'Observações' },
  ];

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

        <View style={styles.vistoriaBadge}>
          <Text variant="caption" style={styles.vistoriaBadgeText}>
            Saída
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
        {activeTab === 'comparativo' && (
          <View style={styles.comparativoContainer}>
            <Text variant="bodySmall" color="#6b7280" style={styles.comparativoHint}>
              Fotografe o veículo nos mesmos ângulos da vistoria de entrada para comparação.
            </Text>
            {FINAL_SLOTS.map((slot) => (
              <ComparativeSlot
                key={slot.key}
                slotKey={slot.key}
                label={slot.label}
                beforePhoto={beforeBySlot.get(slot.key)}
                afterPhoto={afterBySlot.get(slot.key)}
                onAddAfter={handleAddAfter}
              />
            ))}
          </View>
        )}

        {activeTab === 'reparos' && (
          <View style={styles.reparosContainer}>
            <Text variant="label" color="#374151" style={styles.reparosTitle}>
              Confirmação de Reparos
            </Text>
            <Text variant="bodySmall" color="#6b7280" style={styles.reparosHint}>
              Confirme que cada item foi concluído antes de entregar o veículo.
            </Text>
            <RepairChecklist checkedItems={checkedItems} onToggle={handleToggleRepair} />
            <View style={styles.repairSummary}>
              <Text variant="caption" color="#6b7280">
                {checkedItems.size}/{REPAIR_ITEMS.length} itens confirmados
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'obs' && (
          <View style={styles.obsContainer}>
            <Text variant="label" color="#374151" style={styles.obsLabel}>
              Observações Finais
            </Text>
            <TextInput
              style={styles.obsInput}
              value={observacoes}
              onChangeText={setObservacoes}
              placeholder="Descreva o estado de entrega, ajustes realizados, recomendações ao cliente..."
              placeholderTextColor="#9ca3af"
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
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" />
            )}
            <Text variant="label" style={styles.floatingLabel}>
              {isUploading ? 'Enviando...' : `Enviar fotos (${pendingCount})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Footer: Concluir ── */}
      <View style={styles.footer}>
        {nextStatuses.length > 0 ? (
          <>
            <Text variant="caption" color="#6b7280" style={styles.footerHint}>
              Próximo status:{' '}
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
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
              )}
              <Text variant="label" style={styles.concluirLabel}>
                Concluir Vistoria Final
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.concluirBtn, styles.concluirBtnDisabled]}>
            <Ionicons name="lock-closed-outline" size={18} color="#ffffff" />
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
  vistoriaBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    minWidth: 64,
    alignItems: 'center',
  },
  vistoriaBadgeText: {
    color: '#15803d',
    fontWeight: '700',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
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

  // Comparativo
  comparativoContainer: {
    gap: 16,
  },
  comparativoHint: {
    lineHeight: 18,
    marginBottom: 4,
  },
  compSlot: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  compSlotLabel: {
    fontWeight: '600',
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compHalf: {
    flex: 1,
    gap: 4,
  },
  compHalfLabel: {
    textAlign: 'center',
  },
  compImg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  compImgEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  compImgAdd: {
    borderColor: '#fca5a5',
    gap: 4,
  },
  compImgTouch: {
    position: 'relative',
  },
  compPendingBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compArrow: {
    alignSelf: 'center',
    marginTop: 20,
  },
  compAddLabel: {
    color: '#e31b1b',
    fontSize: 10,
  },

  // Repair confirmation
  reparosContainer: {
    gap: 12,
  },
  reparosTitle: {
    fontWeight: '700',
  },
  reparosHint: {
    lineHeight: 18,
  },
  repairList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  repairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  repairCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repairCheckboxChecked: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  repairLabel: {
    flex: 1,
    color: '#374151',
    fontSize: 14,
  },
  repairLabelChecked: {
    color: '#16a34a',
  },
  repairSummary: {
    paddingTop: 4,
  },

  // Observations
  obsContainer: {
    gap: 10,
  },
  obsLabel: {
    marginBottom: 4,
  },
  obsInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
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
    gap: 8,
    backgroundColor: '#374151',
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
    color: '#ffffff',
  },

  // Footer
  footer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  footerHint: {
    textAlign: 'center',
  },
  concluirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e31b1b',
    paddingVertical: 14,
    borderRadius: 12,
  },
  concluirBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  concluirLabel: {
    color: '#ffffff',
  },
});
