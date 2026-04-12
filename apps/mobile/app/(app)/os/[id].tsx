import React, { useCallback } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OSDetailHeader } from '@/components/os/OSDetailHeader';
import { useServiceOrder } from '@/hooks/useServiceOrders';

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
  changed_at: string;
  changed_by?: string;
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
  checklist_saida: 'Checklist de Saida',
  pericia: 'Pericia',
  outros: 'Outros',
};

const OS_TYPE_LABELS: Record<string, string> = {
  insurance: 'Sinistro',
  particular: 'Particular',
  warranty: 'Garantia',
  revision: 'Revisao',
};

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  individual: 'Particular',
  insurer: 'Seguradora',
  company: 'Empresa',
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
      <Text variant="label" color="#374151">
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
      <Text variant="bodySmall" color="#6b7280" style={styles.infoLabel}>
        {label}
      </Text>
      <Text variant="bodySmall" color="#111827" style={styles.infoValue}>
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
      <Text variant="bodySmall" color="#374151" style={styles.photoGroupTitle}>
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
              <Text variant="caption" color="#6b7280" numberOfLines={1} style={styles.photoCaption}>
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
        <Text variant="bodySmall" color="#111827" numberOfLines={2}>
          {item.description}
        </Text>
        <Text variant="caption" color="#9ca3af">
          {item.quantity}x {formatCurrency(item.unit_price)}
        </Text>
      </View>
      <Text variant="bodySmall" color="#374151" style={styles.lineItemTotal}>
        {formatCurrency(item.total)}
      </Text>
    </View>
  );
}

interface TransitionLogItemProps {
  log: OSTransitionLog;
}

function TransitionLogItem({ log }: TransitionLogItemProps): React.JSX.Element {
  return (
    <View style={styles.logItem}>
      <View style={styles.logDot} />
      <View style={styles.logContent}>
        <Text variant="bodySmall" color="#374151">
          {log.from_status} → {log.to_status}
        </Text>
        <Text variant="caption" color="#9ca3af">
          {formatDateTime(log.changed_at)}
          {log.changed_by != null && log.changed_by.length > 0
            ? ` · ${log.changed_by}`
            : ''}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OSDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // The hook returns ServiceOrderDetailAPI; we cast to ServiceOrderDetail because
  // the real API endpoint serializes photos/parts/labor_items/transition_logs.
  // The offline model omits them — they will simply be undefined.
  const { order: rawOrder, isLoading } = useServiceOrder(id ?? '');
  const order = rawOrder as ServiceOrderDetail | null;

  const handleBack = useCallback((): void => {
    router.back();
  }, [router]);

  const handlePhotoPress = useCallback((url: string): void => {
    setPreviewUrl(url);
  }, []);

  const handleClosePreview = useCallback((): void => {
    setPreviewUrl(null);
  }, []);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.loadingHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text variant="body" color="#e31b1b">
              {'← Voltar'}
            </Text>
          </TouchableOpacity>
        </View>
        <LoadingSkeleton />
      </SafeAreaView>
    );
  }

  // ── Empty / not found state ───────────────────────────────────────────────
  if (order === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.emptyContainer}>
          <Text variant="heading3" color="#374151">
            OS nao encontrada
          </Text>
          <Text variant="bodySmall" color="#9ca3af" style={styles.emptyHint}>
            A OS solicitada nao existe ou voce nao tem permissao para visualiza-la.
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

  const photoGroups = order.photos != null && order.photos.length > 0
    ? groupPhotosByFolder(order.photos)
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
              <Text variant="caption" color="#6b7280">
                Pecas
              </Text>
              <Text variant="bodySmall" color="#374151">
                {formatCurrency(order.parts_total)}
              </Text>
            </View>
            <View style={styles.totalItem}>
              <Text variant="caption" color="#6b7280">
                Servicos
              </Text>
              <Text variant="bodySmall" color="#374151">
                {formatCurrency(order.services_total)}
              </Text>
            </View>
            <View style={styles.totalItem}>
              <Text variant="caption" color="#6b7280">
                Total
              </Text>
              <Text variant="label" color="#111827" style={styles.grandTotal}>
                {grandTotal.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </Text>
            </View>
          </View>
        </Card>

        {/* ── Secao 2: Fotos ────────────────────────────────────────────── */}
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

        {/* ── Secao 3: Pecas e Servicos ─────────────────────────────────── */}
        {hasItems && (
          <>
            <SectionHeader title="Pecas e Servicos" />
            <Card style={styles.card}>
              {hasParts && (
                <>
                  <Text variant="label" color="#6b7280" style={styles.subsectionTitle}>
                    Pecas
                  </Text>
                  {order.parts!.map((item) => (
                    <LineItemRow key={item.id} item={item} />
                  ))}
                  <View style={styles.subtotalRow}>
                    <Text variant="bodySmall" color="#6b7280">
                      Subtotal pecas
                    </Text>
                    <Text variant="label" color="#374151">
                      {formatCurrency(order.parts_total)}
                    </Text>
                  </View>
                </>
              )}

              {hasParts && hasLaborItems && <View style={styles.divider} />}

              {hasLaborItems && (
                <>
                  <Text variant="label" color="#6b7280" style={styles.subsectionTitle}>
                    Servicos
                  </Text>
                  {order.labor_items!.map((item) => (
                    <LineItemRow key={item.id} item={item} />
                  ))}
                  <View style={styles.subtotalRow}>
                    <Text variant="bodySmall" color="#6b7280">
                      Subtotal servicos
                    </Text>
                    <Text variant="label" color="#374151">
                      {formatCurrency(order.services_total)}
                    </Text>
                  </View>
                </>
              )}
            </Card>
          </>
        )}

        {/* ── Secao 4: Historico ────────────────────────────────────────── */}
        {hasHistory && (
          <>
            <SectionHeader title="Historico de Status" />
            <Card style={styles.card}>
              {order.transition_logs!.map((log) => (
                <TransitionLogItem key={log.id} log={log} />
              ))}
            </Card>
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

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
    backgroundColor: '#f9fafb',
  },
  // Loading header
  loadingHeader: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    paddingVertical: 4,
  },
  // Skeleton
  skeletonContainer: {
    padding: 16,
    gap: 12,
  },
  skeleton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
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
    backgroundColor: '#f3f4f6',
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
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
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
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
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
  // Bottom spacing
  bottomPadding: {
    height: 32,
  },
  // Photo preview modal
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
});
